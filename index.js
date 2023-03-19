const core = require("@actions/core");
const { execSync } = require("node:child_process");

const inputPrefix = "INPUT_";

try {
  Object.keys(process.env).forEach(function (key) {
    if (key.startsWith(inputPrefix)) {
      const id = key.substring(inputPrefix.length);
      const value = process.env[key];
      execSync(
        `aws secretsmanager put-secret-value --secret-id ${id} --secret-string "${value}"`,
        { stdio: "inherit" }
      );
    }
  });
} catch (error) {
  core.setFailed(error.message);
}
