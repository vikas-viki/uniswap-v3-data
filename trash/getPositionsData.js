import { gql, Client, cacheExchange, fetchExchange } from "@urql/core";
import fetch from "node-fetch";
import { parse } from "json2csv";
import fs from "fs";
import * as constants from "../constants.cjs";

const client = new Client({
  url: constants.ETH_QUERY_URL,
  exchanges: [cacheExchange, fetchExchange],
  fetch: fetch,
});

const poolMetadataQuery = gql`
  query GetPoolMetadata($pool: ID!) {
    liquidityPool(id: $pool) {
      symbol
      inputTokens {
        id
      }
      positionCount
    }
  }
`;

const positionsQuery = gql`
  query GetPositions($pool: ID!, $lastTimestampOpened: BigInt) {
    liquidityPool(id: $pool) {
      positions(
        first: 1000
        orderBy: timestampOpened
        orderDirection: asc
        where: { timestampOpened_gt: $lastTimestampOpened }
      ) {
        tickLower {
          index
        }
        tickUpper {
          index
        }
        account {
          id
          deposits {
            amountUSD
            blockNumber
          }
          withdraws {
            amountUSD
            blockNumber
          }
        }
        blockNumberOpened
        blockNumberClosed
        timestampClosed
        cumulativeDepositUSD
        cumulativeWithdrawUSD
        cumulativeRewardUSD
        timestampOpened
      }
    }
  }
`;

const getPoolMetadata = async (poolId) => {
  const result = await client.query(poolMetadataQuery, { pool: poolId }).toPromise();
  console.log(result.data);
  return result.data.liquidityPool;
};

const getPositions = async (poolId, positionCount) => {
  const positions = [];
  let lastTimestampOpened = "0";
  console.log("Position count: ", positionCount);
  for (let i = 0; i < positionCount; i += 1000) {
    try {

      const result = await client
        .query(positionsQuery, { pool: poolId, lastTimestampOpened })
        .toPromise();

      const fetchedPositions = result?.data?.liquidityPool?.positions;
      if (!fetchedPositions.length) break;

      positions.push(...fetchedPositions);
      lastTimestampOpened = fetchedPositions[fetchedPositions.length - 1].timestampOpened;
      console.log("fetched!");
    } catch (error) {
      console.log("ERROR");
    }
  }

  return positions;
};

const getPoolData = async (poolId) => {
  const poolMetadata = await getPoolMetadata(poolId);
  const positions = await getPositions(poolId, poolMetadata.positionCount);

  const data = [
    {
      'Pool Symbol': poolMetadata.symbol,
      'Pool Address': poolId,
      'Token 0 Address': poolMetadata.inputTokens[0].id,
      'Token 1 Address': poolMetadata.inputTokens[1].id,
    },
    {},
    {
      'Account': 'Account',
      'Tick Lower': 'Tick Lower',
      'Tick Upper': 'Tick Upper',
      'Block Number Opened': 'Block Number Opened',
      'Block Number Closed': 'Block Number Closed',
      'Timestamp Closed': 'Timestamp Closed',
      'Timestamp Opened': 'Timestamp Opened',
      'Cumulative Deposit USD': 'Cumulative Deposit USD',
      'Cumulative Withdraw USD': 'Cumulative Withdraw USD',
      'Cumulative Reward USD': 'Cumulative Reward USD',
      'Deposits (blockNumber:USD)': 'Deposits (blockNumber:USD)',
      'Withdraws (blockNumber:USD)': 'Withdraws (blockNumber:USD)',
    },
    ...positions.map(position => ({
      'Account': position.account.id,
      'Tick Lower': position.tickLower.index,
      'Tick Upper': position.tickUpper.index,
      'Block Number Opened': position.blockNumberOpened,
      'Block Number Closed': position.blockNumberClosed,
      'Timestamp Closed': position.timestampClosed,
      'Timestamp Opened': position.timestampOpened,
      'Cumulative Deposit USD': position.cumulativeDepositUSD,
      'Cumulative Withdraw USD': position.cumulativeWithdrawUSD,
      'Cumulative Reward USD': position.cumulativeRewardUSD,
      'Deposits (blockNumber:USD)': position.account.deposits
        .map(deposit => `${deposit.blockNumber}:${deposit.amountUSD}`)
        .join(', '),
      'Withdraws (blockNumber:USD)': position.account.withdraws
        .map(withdraw => `${withdraw.blockNumber}:${withdraw.amountUSD}`)
        .join(', '),
    })),
  ];

  const csv = parse(data);
  const filePath = 'USDT_USDC_positions.csv';
  fs.writeFileSync(filePath, csv);

  console.log('CSV file written successfully');
};

// Replace with your desired pool ID
const poolId = "0x3416cF6C708Da44DB2624D63ea0AAef7113527C6";
getPoolData(poolId);
