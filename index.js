const core = require("@actions/core");
const { readFileSync, rmSync } = require("node:fs");
const { execSync } = require("node:child_process");
const { join } = require("node:path");

// All github actions input is prefixed with INPUT_
const inputPrefix = "INPUT_";
const PREFIX = (process.env.INPUT_PREFIX || "appsecrets").replace(/^\/+/, "");

try {
  const resFile = join(__dirname, "existing.json");
  // Get all existing parameters under prefix into a json file
  execSync(
    `aws ssm get-parameters-by-path --path /${PREFIX} --recursive > ${resFile}`
  );

  // Load them into memory as "path[]", to determine if anyone should be deleted
  let remainingPaths = JSON.parse(readFileSync(resFile)).Parameters.map(
    ({ Name }) => Name
  );

  // Remove json file
  rmSync(resFile);

  // Turn SOME_SECRET into /{prefix}/SOME_SECRET
  const variables = Object.keys(process.env)
    .map(function (key) {
      if (key.startsWith(inputPrefix) && key !== "INPUT_PREFIX") {
        const id = `/${PREFIX}/${key.substring(inputPrefix.length)}`;
        const value = process.env[key];
        return [id, value];
      }
      return null;
    })
    .filter((v) => !!v);

  // Save all variable
  variables.forEach(([key, value]) => {
    if (value) {
      console.log(`Saving variable ${key}`);
      execSync(
        `aws ssm put-parameter --name "${key}" --value "${value}" --type "SecureString" --overwrite`
      );
      // Remove this path from remainingPaths
      remainingPaths = remainingPaths.filter((path) => path != key);
    }
  });

  // If any paths are left, delete them all
  if (remainingPaths.length) {
    const varsToDelete = remainingPaths.map((path) => `"${path}"`).join(" ");
    console.log(`Deleting variables ${varsToDelete}`);
    execSync(`aws ssm delete-parameters --names ${varsToDelete}`);
  }
} catch (error) {
  core.setFailed(error.message);
}
