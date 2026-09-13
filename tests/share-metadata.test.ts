import { test } from "node:test";
import assert from "node:assert/strict";
import { stopShareTitle } from "../src/lib/share-metadata";

test("shared titles start with one STOP without a trailing brand suffix", () => {
  assert.equal(stopShareTitle("رمي الزبل فالزنقة"), "STOP رمي الزبل فالزنقة");
  assert.equal(stopShareTitle("STOP لاستعمال الهاتف"), "STOP لاستعمال الهاتف");
  assert.equal(stopShareTitle("stop STOP: رمي الزبل STOP"), "STOP رمي الزبل");
  assert.equal(stopShareTitle("STOP"), "STOP");
});
