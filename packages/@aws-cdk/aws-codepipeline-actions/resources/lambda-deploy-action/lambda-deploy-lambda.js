var AWS = require('aws-sdk');

exports.handler = async function (event, context) {
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
        try {
            const data = await s3.getObject({
                Key: s3Location.objectKey,
            }).promise();

            console.log(`S3 data: ${data}`);
        } catch (err) {
            console.error(err, err.stack);
        }
    }

    const codepipeline = new AWS.CodePipeline();
    try {
        await codepipeline.putJobSuccessResult({
            jobId: pipelineEvent.id,
        }).promise();
    } catch (err) {
        context.fail(err);
    }
    context.succeed('Hello from Lambda!');
};
