import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2, Context } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const mockSend = jest.fn();

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/lib-dynamodb');
  return {
    ...actual,
    DynamoDBDocumentClient: { from: () => ({ send: mockSend }) },
  };
});

process.env.SESSION_TABLE = 'Sessions';
process.env.SPIN_HISTORY_TABLE = 'SpinHistory';

// Imported after the mock and env are in place
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { handler } = require('../lambda/api/sessions') as typeof import('../lambda/api/sessions');

function tokenFor(sub: string): string {
  const payload = Buffer.from(JSON.stringify({ sub })).toString('base64url');
  return `Bearer header.${payload}.signature`;
}

function historyEvent(sub: string, sessionId = 'session-1'): APIGatewayProxyEventV2 {
  return {
    routeKey: 'GET /sessions/{id}/history',
    pathParameters: { id: sessionId },
    headers: { authorization: tokenFor(sub) },
  } as unknown as APIGatewayProxyEventV2;
}

async function invoke(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyStructuredResultV2> {
  const context = { awsRequestId: 'test-request' } as Context;
  return (await handler(event, context, () => undefined)) as APIGatewayProxyStructuredResultV2;
}

describe('GET /sessions/{id}/history', () => {
  beforeEach(() => {
    mockSend.mockReset();
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('returns 404 and never queries history when the caller does not own the session', async () => {
    mockSend.mockResolvedValueOnce({ Item: { sessionId: 'session-1', adminId: 'owner' } });

    const result = await invoke(historyEvent('someone-else'));

    expect(result.statusCode).toBe(404);
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockSend.mock.calls[0][0]).toBeInstanceOf(GetCommand);
  });

  it('returns 404 when the session does not exist', async () => {
    mockSend.mockResolvedValueOnce({});

    const result = await invoke(historyEvent('owner'));

    expect(result.statusCode).toBe(404);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('queries newest first, limited to 20, and returns the items for the owner', async () => {
    const items = [
      { sessionId: 'session-1', 'timestamp#spinId': '2000#b', winner: 'Tau', timestamp: 2000 },
      { sessionId: 'session-1', 'timestamp#spinId': '1000#a', winner: 'Chi', timestamp: 1000 },
    ];
    mockSend
      .mockResolvedValueOnce({ Item: { sessionId: 'session-1', adminId: 'owner' } })
      .mockResolvedValueOnce({ Items: items });

    const result = await invoke(historyEvent('owner'));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual(items);
    const query = mockSend.mock.calls[1][0];
    expect(query).toBeInstanceOf(QueryCommand);
    expect(query.input).toMatchObject({
      TableName: 'SpinHistory',
      KeyConditionExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: { ':sessionId': 'session-1' },
      ScanIndexForward: false,
      Limit: 20,
    });
  });

  it('returns an empty array when there are no spins', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: { sessionId: 'session-1', adminId: 'owner' } })
      .mockResolvedValueOnce({});

    const result = await invoke(historyEvent('owner'));

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body as string)).toEqual([]);
  });
});

describe('spin writes', () => {
  beforeEach(() => {
    mockSend.mockReset();
    jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
  });

  afterEach(() => jest.restoreAllMocks());

  it('writes the timestamp#spinId sort key with a numeric timestamp that matches its prefix', async () => {
    mockSend
      .mockResolvedValueOnce({ Item: { sessionId: 'session-1', adminId: 'owner', nameListSnapshot: ['Boots'] } })
      .mockResolvedValueOnce({});

    const event = {
      routeKey: 'POST /sessions/{id}/spin',
      pathParameters: { id: 'session-1' },
      headers: { authorization: tokenFor('owner') },
    } as unknown as APIGatewayProxyEventV2;
    const result = await invoke(event);

    expect(result.statusCode).toBe(200);
    const item = mockSend.mock.calls[1][0].input.Item;
    expect(typeof item.timestamp).toBe('number');
    expect(item['timestamp#spinId']).toMatch(new RegExp(`^${item.timestamp}#[0-9a-f-]{36}$`));
  });
});
