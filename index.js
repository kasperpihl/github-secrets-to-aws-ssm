const core = require("@actions/core");

const inputPrefix = "INPUT_";

try {
  let envFileContent = "";

  Object.keys(process.env).forEach(function (key) {
    if (key.startsWith(inputPrefix)) {
      envFileContent += `${key.substring(inputPrefix.length)}=${
        process.env[key]
      }\n`;
    }
  });
  console.log(envFileContent);
} catch (error) {
  core.setFailed(error.message);
}
