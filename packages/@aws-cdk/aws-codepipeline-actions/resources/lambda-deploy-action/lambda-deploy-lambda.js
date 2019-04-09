var AWS = require('aws-sdk');

exports.handler = function (event, context) {
    console.info("Called with Event: " + JSON.stringify(event, null, 2));

    const pipelineEvent = event['CodePipeline.job'];
    const pipelineData = pipelineEvent['data'];

    const inputs = pipelineData['inputArtifacts'];
    if (inputs.length > 0) {
        const s3Location = inputs[0]['location']['s3Location'];
        const s3 = new AWS.S3({
            ...pipelineData.artifactCredentials,
            params: {
                Bucket: s3Location.bucketName,
            },
        });
        s3.getObject({
            Key: s3Location.objectKey,
        }, function (err, data) {
            if (err) {
                console.error(err, err.stack);
            } else {
                console.log(`S3 data: ${data}`);
            }
        });
    }

    callPipelineApi(pipelineEvent.id, context);
};

function callPipelineApi(jobId, context) {
    const codepipeline = new AWS.CodePipeline();
    codepipeline.putJobSuccessResult({
        jobId: jobId,
    }, function (err) {
        if (err) {
            context.fail(err);
        } else {
            context.succeed('Hello from Lambda!');
        }
    });
}
