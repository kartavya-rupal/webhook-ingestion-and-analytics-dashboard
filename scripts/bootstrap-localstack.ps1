$ErrorActionPreference = "Stop"

$env:AWS_ACCESS_KEY_ID = "test"
$env:AWS_SECRET_ACCESS_KEY = "test"
$env:AWS_DEFAULT_REGION = "ap-south-1"

$endpoint = "http://localhost:4566"
$region = "ap-south-1"
$bucket = "finrelay-dev-raw-events"
$dlqName = "finrelay-local-dlq"
$mainQueueName = "finrelay-local-main-queue"

Write-Host "Creating S3 bucket..."
aws --endpoint-url $endpoint s3 mb "s3://$bucket" --region $region | Out-Null
aws --endpoint-url $endpoint s3api put-bucket-versioning `
  --bucket $bucket `
  --versioning-configuration Status=Enabled `
  --region $region | Out-Null

Write-Host "Creating DLQ..."
$dlqUrl = aws --endpoint-url $endpoint sqs create-queue `
  --queue-name $dlqName `
  --attributes MessageRetentionPeriod=604800 `
  --region $region `
  --query QueueUrl `
  --output text

Write-Host "Creating main queue..."
$mainQueueUrl = aws --endpoint-url $endpoint sqs create-queue `
  --queue-name $mainQueueName `
  --attributes VisibilityTimeout=120,MessageRetentionPeriod=345600 `
  --region $region `
  --query QueueUrl `
  --output text

$dlqArn = aws --endpoint-url $endpoint sqs get-queue-attributes `
  --queue-url $dlqUrl `
  --attribute-names QueueArn `
  --region $region `
  --query 'Attributes.QueueArn' `
  --output text

$redrivePolicy = "{""maxReceiveCount"":""5"",""deadLetterTargetArn"":""$dlqArn""}"

aws --endpoint-url $endpoint sqs set-queue-attributes `
  --queue-url $mainQueueUrl `
  --attributes "RedrivePolicy=$redrivePolicy" `
  --region $region | Out-Null

Write-Host ""
Write-Host "LocalStack bootstrap complete."
Write-Host "Bucket: $bucket"
Write-Host "DLQ URL: $dlqUrl"
Write-Host "Main queue URL: $mainQueueUrl"