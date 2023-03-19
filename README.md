# github-secrets-to-aws-ssm action

```yaml
on:
  push:
    branches:
      - master
jobs:
  github_secrets_job:
    runs-on: ubuntu-latest
    steps:
      - name: Make AWS Secrets
        uses: kasperpihl/github-secrets-to-aws-ssm@main
        with:
          TEST_API_KEY: ${{ secrets.TEST_API_KEY }}
          ANOTHER_KEY: ${{ secrets.ANOTHER_KEY }}
```

**NOTE:** be sure that `ubuntu-latest` or any other image you use has node installed.

## License

This project released under the [MIT License](LICENSE).
