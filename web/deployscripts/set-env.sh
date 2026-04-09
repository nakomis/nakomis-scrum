#!/bin/bash

# Populates the Vite .env file for the selected environment from AWS CloudFormation outputs.
# Usage: ./set-env.sh [sandbox|prod|localhost]
#
# NOTE: Do not edit .env.template to add AWS-derived values — this script manages those.
#       Manually-set values (e.g. third-party keys) should be added directly to .env.template
#       and will be preserved when the script is re-run, since only <PLACEHOLDER> tokens are replaced.

set -e

function getOutput() {
    local stack_name="$1"
    local output_key="$2"
    aws cloudformation describe-stacks \
        --stack-name "$stack_name" \
        --query "Stacks[0].Outputs[?OutputKey=='$output_key'].OutputValue" \
        --output text
}

function setValue() {
    local key="$1"
    local value="$2"
    echo "Setting $key"
    sed -i.bk "s|<$key>|$value|g" "$ENV_FILE"
}

PARAM=$1
ENV="${PARAM:=sandbox}"

if [[ $ENV == "localhost" ]]; then
    export AWS_ENV=sandbox
else
    export AWS_ENV=$ENV
fi

SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"
ENV_FILE="$SCRIPT_DIR/../.env.$ENV"
export AWS_PROFILE=nakom.is-$AWS_ENV

echo "Configuring for environment: $ENV (AWS profile: $AWS_PROFILE)"

cp "$SCRIPT_DIR/../.env.template" "$ENV_FILE"

USER_POOL_ID=$(getOutput NakomisScrumCognito UserPoolId)
USER_POOL_CLIENT_ID=$(getOutput NakomisScrumCognito UserPoolClientId)
API_ENDPOINT=$(getOutput NakomisScrumApi ApiEndpoint)
WS_ENDPOINT=$(getOutput NakomisScrumWebSocket WsApiEndpoint)

setValue COGNITO_AUTHORITY "https://cognito-idp.eu-west-2.amazonaws.com/$USER_POOL_ID"
setValue COGNITO_CLIENT_ID "$USER_POOL_CLIENT_ID"
setValue API_URL "$API_ENDPOINT"
setValue WS_URL "$WS_ENDPOINT"

case $ENV in
    prod)
        setValue COGNITO_REDIRECT_URI "https://scrum.nakomis.com/auth/callback"
        ;;
    sandbox)
        setValue COGNITO_REDIRECT_URI "https://scrum.sandbox.nakomis.com/auth/callback"
        ;;
    localhost)
        setValue COGNITO_REDIRECT_URI "http://localhost:5173/auth/callback"
        ;;
    *)
        echo "Unknown environment: $ENV"
        exit 1
        ;;
esac

rm -f "$ENV_FILE.bk"
echo "Written to $ENV_FILE"
