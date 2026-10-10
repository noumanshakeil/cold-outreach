import assert from "node:assert/strict";
import { applyMergeTags, htmlToPlainText, isValidEmail } from "./merge";

assert.equal(
  applyMergeTags("Hi {{name}} at {{company}}", {
    email: "a@b.com",
    name: "Ada",
    company: "Analytica",
  }),
  "Hi Ada at Analytica"
);

assert.equal(
  applyMergeTags("Role: {{custom.role}}", {
    email: "a@b.com",
    customFields: { role: "CTO" },
  }),
  "Role: CTO"
);

assert.equal(isValidEmail("ok@example.com"), true);
assert.equal(isValidEmail("nope"), false);
assert.ok(htmlToPlainText("<p>Hello<br/>world</p>").includes("Hello"));

console.log("merge.test.ts passed");
