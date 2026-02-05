# github-secrets-to-aws-ssm action

Sync GitHub Secrets to AWS Systems Manager (SSM) Parameter Store with automatic parameter cleanup.

## Features

- ✅ Creates new parameters or updates existing ones
- ✅ Uses SecureString type for encrypted storage (KMS)
- ✅ Supports PREFIX for organized parameter namespacing
- ✅ Automatically deletes parameters that are removed from GitHub
- ✅ Safe: Only manages parameters with the specified PREFIX
- ✅ Free tier: Up to 10,000 standard parameters at no cost
- ✅ Multi-environment support via GitHub environments

## Usage

### Basic Example

```yaml
name: Sync Secrets
on:
  workflow_dispatch:

jobs:
  sync_secrets:
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GithubActionsRole
          aws-region: us-east-1

      - name: Sync to SSM Parameter Store
        uses: kasperpihl/github-secrets-to-aws-ssm@main
        with:
          PREFIX: myapp
          API_KEY: ${{ secrets.API_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          WEBHOOK_SECRET: ${{ secrets.WEBHOOK_SECRET }}
```

This creates parameters in AWS SSM Parameter Store:
- `/myapp/API_KEY` (SecureString)
- `/myapp/DATABASE_URL` (SecureString)
- `/myapp/WEBHOOK_SECRET` (SecureString)

### Multi-Environment Example

Use GitHub environments to manage different AWS accounts/regions:

```yaml
name: Sync Secrets
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment'
        type: environment
        default: 'dev'

jobs:
  sync_secrets:
    environment: ${{ inputs.environment }}
    runs-on: ubuntu-latest
    steps:
      - name: Load environment file
        uses: xom9ikk/dotenv@v2
        with:
          mode: ${{ inputs.environment }}

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::${{ env.AWS_ACCOUNT }}:role/GithubDeploymentRole-${{ github.event.repository.name }}
          aws-region: us-east-1

      - name: Sync to SSM Parameter Store
        uses: kasperpihl/github-secrets-to-aws-ssm@main
        with:
          PREFIX: ${{ github.event.repository.name }}
          GOOGLE_OAUTH_CLIENT_SECRET: ${{ secrets.GOOGLE_OAUTH_CLIENT_SECRET }}
          STRIPE_API_KEY: ${{ secrets.STRIPE_API_KEY }}
          SENDGRID_API_KEY: ${{ secrets.SENDGRID_API_KEY }}
```

Each environment (dev, staging, prod) syncs to its own AWS account, but uses the same parameter names.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `PREFIX` | Prefix for organizing parameters | No | `appsecrets` |
| Additional inputs | Any other input becomes a parameter | No | - |

## Parameter Naming

Parameters are named: `/{PREFIX}/{SECRET_NAME}`

Examples:
- `/myapp/API_KEY`
- `/myapp/DATABASE_URL`
- `/myapp/WEBHOOK_SECRET`

## Automatic Cleanup

The action automatically deletes parameters that:
1. Match the `PREFIX`
2. Are not included in the GitHub Action inputs

This keeps your Parameter Store clean and synchronized with GitHub Secrets.

**Safety**: Only parameters with the specified `PREFIX` are managed. Other parameters in your AWS account are never touched.

## Use Cases

### 1. Lambda Runtime Secrets

SSM Parameter Store is perfect for Lambda functions that fetch secrets at runtime:

```typescript
// Lambda code
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm';

const ssm = new SSMClient({});

export async function getSecret(name: string) {
  const response = await ssm.send(
    new GetParameterCommand({
      Name: `/myapp/${name}`,
      WithDecryption: true, // Decrypt SecureString
    })
  );
  return response.Parameter?.Value;
}

// Usage
const apiKey = await getSecret('API_KEY');
```

### 2. Cost-Effective Secret Storage

Use SSM for most secrets (free) and Secrets Manager only when required by CloudFormation:

```yaml
jobs:
  sync_all_secrets:
    runs-on: ubuntu-latest
    steps:
      # Most secrets → SSM (free, fast)
      - uses: kasperpihl/github-secrets-to-aws-ssm@main
        with:
          PREFIX: myapp
          API_KEY: ${{ secrets.API_KEY }}
          WEBHOOK_SECRET: ${{ secrets.WEBHOOK_SECRET }}
          SENDGRID_API_KEY: ${{ secrets.SENDGRID_API_KEY }}

      # Only Cognito secrets → Secrets Manager (required for CloudFormation)
      - uses: kasperpihl/github-secrets-to-aws-secrets-manager@main
        with:
          PREFIX: myapp
          GOOGLE_OAUTH_CLIENT_SECRET: ${{ secrets.GOOGLE_OAUTH_CLIENT_SECRET }}
```

### 3. Shared Configuration

Use SSM for configuration that's shared across all stages:

```yaml
- uses: kasperpihl/github-secrets-to-aws-ssm@main
  with:
    PREFIX: myapp
    GOOGLE_OAUTH_CLIENT_ID: ${{ secrets.GOOGLE_OAUTH_CLIENT_ID }}
    STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_PUBLISHABLE_KEY }}
    AWS_REGION: us-east-1
```

## Requirements

- AWS credentials configured (use `aws-actions/configure-aws-credentials@v4`)
- IAM permissions:
  ```json
  {
    "Version": "2012-10-17",
    "Statement": [
      {
        "Effect": "Allow",
        "Action": [
          "ssm:PutParameter",
          "ssm:DeleteParameter",
          "ssm:DeleteParameters",
          "ssm:GetParametersByPath",
          "kms:Decrypt"
        ],
        "Resource": "*"
      }
    ]
  }
  ```

## Cost

AWS SSM Parameter Store pricing (as of 2026):

**Standard Parameters (what this action uses):**
- **Storage**: FREE (up to 10,000 parameters, 4KB each)
- **API calls**: FREE (up to 40 TPS standard throughput)
- **Higher throughput**: $0.05 per 10,000 API calls (optional, 3,000 TPS)

**Advanced Parameters (not used by this action):**
- Storage: $0.05/month per parameter
- API calls: $0.05 per 10,000 requests

**Example cost for typical usage**: $0/month (free tier covers most applications)

## SSM vs Secrets Manager

| Feature | SSM Parameter Store | Secrets Manager |
|---------|-------------------|----------------|
| **Cost** | FREE (standard) | $0.40/secret/month |
| **Use for** | Lambda runtime secrets, configs | CloudFormation refs, DB rotation |
| **Encryption** | KMS SecureString | KMS with rotation |
| **Automatic rotation** | ❌ No | ✅ Yes |
| **CloudFormation support** | ⚠️ Limited | ✅ Full support |
| **Best for** | Cost-sensitive, high-throughput | Compliance, automatic rotation |

**Recommendation**: Use SSM for most secrets, Secrets Manager only when CloudFormation requires it (e.g., Cognito) or automatic rotation is needed (e.g., database passwords).

## Security Features

- **Encryption at rest**: All parameters use SecureString type (encrypted with AWS KMS)
- **Encryption in transit**: HTTPS for all API calls
- **IAM-based access**: Fine-grained permission control
- **CloudTrail logging**: Full audit trail of all parameter access
- **No plaintext storage**: Secrets never stored in plaintext

## Limitations

- Parameter size: 4KB max (use Secrets Manager for larger values)
- CloudFormation: Limited dynamic reference support (use Secrets Manager for Cognito, etc.)
- Rotation: Manual only (use Secrets Manager for automatic rotation)

## Troubleshooting

### Error: "Parameter already exists"

This shouldn't happen with the updated logic, but if it does:
- The action tries to overwrite existing parameters
- Check IAM permissions for `ssm:PutParameter`

### Error: "Access Denied"

- Ensure the IAM role has permissions listed in Requirements section
- Check KMS key permissions if using a custom KMS key

### Parameters not deleted

- The action only deletes parameters matching `PREFIX`
- Check that the PREFIX matches your existing parameters
- Parameters are deleted when removed from the GitHub Action inputs

## License

This project is released under the [MIT License](LICENSE).
