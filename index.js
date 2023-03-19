const core = require("@actions/core");
const { readFileSync, rmSync } = require("node:fs");
const { execSync } = require("node:child_process");
const { join } = require("node:path");

const inputPrefix = "INPUT_";

try {
  const resFile = join(__dirname, "existing.json");
  execSync(
    `aws ssm get-parameters-by-path --path /appsecrets --recursive --profile qbdev > ${resFile}`
  );

  let remainingPaths = JSON.parse(readFileSync(resFile)).Parameters.map(
    ({ Name }) => Name
  );

  rmSync(resFile);

  const variables = Object.keys(process.env)
    .map(function (key) {
      if (key.startsWith(inputPrefix)) {
        const id = `/appsecrets/${key.substring(inputPrefix.length)}`;
        const value = process.env[key];
        return [id, value];
      }
      return null;
    })
    .filter((v) => !!v);

  variables.forEach(([key, value]) => {
    console.log(`Saving variable ${key}`);
    execSync(
      `aws ssm put-parameter --name "${key}" --value "${value}" --type "SecureString" --overwrite --profile qbdev`
    );
    remainingPaths = remainingPaths.filter((path) => path != key);
  });

  if (remainingPaths.length) {
    const varsToDelete = remainingPaths.map((path) => `"${path}"`).join(" ");
    console.log(`Deleting variables ${varsToDelete}`);
    execSync(
      `aws ssm delete-parameters --names ${varsToDelete} --profile qbdev`
    );
  }
} catch (error) {
  core.setFailed(error.message);
}
