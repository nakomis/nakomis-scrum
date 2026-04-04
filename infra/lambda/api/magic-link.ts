import { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import crypto from 'crypto';

const base64url = (buf: Buffer): string =>
  buf.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const sessionId = event.pathParameters?.id;
    if (!sessionId) {
      return { statusCode: 400, body: JSON.stringify({ error: "Session ID is required" }) };
    }

    const jwtSecret = process.env.JWT_SECRET || "";
    const appDomain = process.env.APP_DOMAIN || "";

    if (!jwtSecret || !appDomain) {
      return { statusCode: 500, body: JSON.stringify({ error: "Missing environment variables" }) };
    }

    const payload = {
      sessionId,
      type: "magic-link",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400
    };

    const header = { alg: "HS256", typ: "JWT" };
    const encodedHeader = base64url(Buffer.from(JSON.stringify(header)));
    const encodedPayload = base64url(Buffer.from(JSON.stringify(payload)));

    const signature = crypto.createHmac("sha256", jwtSecret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest('base64')
      .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

    const token = `${encodedHeader}.${encodedPayload}.${signature}`;
    const magicLinkUrl = `https://${appDomain}/join?token=${token}`;

    return {
      statusCode: 200,
      body: JSON.stringify({ url: magicLinkUrl, token, expiresAt: payload.exp })
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: "Internal Server Error" }) };
  }
};
