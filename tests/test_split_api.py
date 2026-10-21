"""Offline regression tests for safe publication of the static API."""
import contextlib
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest
from unittest import mock


SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "split_api.py"
SPEC = importlib.util.spec_from_file_location("split_api", SCRIPT)
split_api = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(split_api)


class SplitApiTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="test-split-api-")
        self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.api = self.root / "api"
        self.api.mkdir()
        (self.api / "index.json").write_bytes(b'{"previous":true}\n')
        (self.api / "papers").mkdir()
        (self.api / "papers" / "page-999.json").write_bytes(b'[{"old":true}]')
        self.previous = self.snapshot()
        self.write_source("papers.json", [
            {"id": "1", "title": "第一篇", "year": 2026, "tags": ["LLM"]},
            {"id": "2", "title": "Second paper", "year": 2025},
            {"id": "3", "title": "Third paper", "year": 2024},
        ])
        self.patch = mock.patch.multiple(split_api, ROOT=str(self.root), API=str(self.api))
        self.patch.start()
        self.addCleanup(self.patch.stop)
        self.stdout = contextlib.redirect_stdout(io.StringIO())
        self.stdout.__enter__()
        self.addCleanup(self.stdout.__exit__, None, None, None)

    def write_source(self, filename, data):
        (self.root / filename).write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")

    def snapshot(self):
        return {str(p.relative_to(self.api)): p.read_bytes()
                for p in self.api.rglob("*") if p.is_file()}

    def assert_previous_intact(self):
        self.assertEqual(self.snapshot(), self.previous)
        self.assertFalse((self.root / ".split-api.lock").exists())
        self.assertEqual(list(self.root.glob(".api-build-*")), [])

    def test_invalid_primary_json_keeps_previous_api(self):
        (self.root / "papers.json").write_text("{broken")
        with self.assertRaises(json.JSONDecodeError):
            split_api.build_api(2)
        self.assert_previous_intact()

    def test_missing_primary_source_keeps_previous_api(self):
        (self.root / "papers.json").unlink()
        with self.assertRaises(FileNotFoundError):
            split_api.build_api(2)
        self.assert_previous_intact()

    def test_invalid_primary_shape_keeps_previous_api(self):
        for data in ({}, ["not a paper object"]):
            with self.subTest(data=data):
                self.write_source("papers.json", data)
                with self.assertRaisesRegex(ValueError, "list of paper objects"):
                    split_api.build_api(2)
                self.assert_previous_intact()

    def test_invalid_supplement_keeps_previous_api(self):
        (self.root / "models.json").write_text("{broken")
        with self.assertRaises(json.JSONDecodeError):
            split_api.build_api(2)
        self.assert_previous_intact()

    def test_staging_write_failure_keeps_previous_api(self):
        original = split_api.write_json

        def fail_page(path, data):
            if pathlib.Path(path).name == "page-002.json":
                raise OSError("simulated disk full")
            return original(path, data)

        with mock.patch.object(split_api, "write_json", side_effect=fail_page):
            with self.assertRaisesRegex(OSError, "disk full"):
                split_api.build_api(2)
        self.assert_previous_intact()

    def test_failed_publish_restores_previous_api(self):
        original = split_api.os.replace

        def fail_publish(src, dst):
            if pathlib.Path(src).name == "api" and pathlib.Path(src).parent != self.root:
                raise OSError("simulated publication failure")
            return original(src, dst)

        with mock.patch.object(split_api.os, "replace", side_effect=fail_publish):
            with self.assertRaisesRegex(OSError, "publication failure"):
                split_api.build_api(2)
        self.assert_previous_intact()

    def test_failed_rollback_retains_recoverable_backup(self):
        original = split_api.os.replace

        def fail_publish_and_rollback(src, dst):
            if pathlib.Path(src).parent != self.root:
                raise OSError("simulated rename failure")
            return original(src, dst)

        with mock.patch.object(split_api.os, "replace", side_effect=fail_publish_and_rollback):
            with contextlib.redirect_stderr(io.StringIO()) as stderr:
                with self.assertRaisesRegex(OSError, "rename failure"):
                    split_api.build_api(2)
        backups = list(self.root.glob(".api-build-*/previous-api"))
        self.assertEqual(len(backups), 1)
        self.assertEqual({str(p.relative_to(backups[0])): p.read_bytes()
                          for p in backups[0].rglob("*") if p.is_file()}, self.previous)
        self.assertIn(str(backups[0]), stderr.getvalue())
        self.assertFalse((self.root / ".split-api.lock").exists())

    def test_lock_excludes_another_splitter(self):
        lock = self.root / ".split-api.lock"
        lock.mkdir()
        with self.assertRaisesRegex(RuntimeError, "already locked"):
            split_api.build_api(2)
        self.assertEqual(self.snapshot(), self.previous)
        self.assertTrue(lock.exists())

    def test_success_replaces_all_pages_and_preserves_supplement_bytes(self):
        supplement = b'[\n  {"company": "Example"}\n]\n'
        (self.root / "company-papers.json").write_bytes(supplement)
        split_api.build_api(2)
        index = json.loads((self.api / "index.json").read_text())
        self.assertEqual((index["total"], index["pageSize"], index["totalPages"]), (3, 2, 2))
        pages = sorted((self.api / "papers").glob("*.json"))
        self.assertEqual([p.name for p in pages], ["page-001.json", "page-002.json"])
        self.assertEqual([len(json.loads(p.read_text())) for p in pages], [2, 1])
        self.assertEqual(json.loads(pages[0].read_text())[0]["title"], "第一篇")
        self.assertEqual([p["id"] for p in json.loads((self.api / "search-index.json").read_text())],
                         ["1", "2", "3"])
        self.assertEqual((self.api / "company-papers.json").read_bytes(), supplement)
        self.assertFalse((self.root / ".split-api.lock").exists())
        self.assertEqual(list(self.root.glob(".api-build-*")), [])

    def test_first_build_and_empty_dataset(self):
        import shutil
        shutil.rmtree(self.api)
        self.write_source("papers.json", [])
        split_api.build_api(2)
        index = json.loads((self.api / "index.json").read_text())
        self.assertEqual((index["total"], index["totalPages"]), (0, 0))
        self.assertEqual(json.loads((self.api / "search-index.json").read_text()), [])

    def test_invalid_cli_page_sizes_leave_api_untouched(self):
        for args in (["0"], ["-1"], ["--page-size", "0"], ["--page-size", "bad"],
                     ["2", "--page-size", "3"]):
            with self.subTest(args=args), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as error:
                    split_api.main(args)
                self.assertEqual(error.exception.code, 2)
                self.assert_previous_intact()

    def test_cli_supports_documented_and_legacy_page_size(self):
        for args in (["--page-size", "2"], ["2"]):
            with self.subTest(args=args):
                split_api.main(args)
                index = json.loads((self.api / "index.json").read_text())
                self.assertEqual(index["pageSize"], 2)


if __name__ == "__main__":
    unittest.main()
