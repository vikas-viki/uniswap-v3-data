import { gql, Client, cacheExchange, fetchExchange } from "@urql/core";
import fetch from "node-fetch";
import * as constants from "../constants.cjs";
import BigNumber from "bignumber.js";
import fs from "fs";
import { parse } from "json2csv";

BigNumber.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

const client = new Client({
  url: constants.ETH_QUERY_URL,
  exchanges: [cacheExchange, fetchExchange],
  fetch: fetch,
});

const client_Messari = new Client({
  url: constants.MESSARI_ETH_URL,
  exchanges: [cacheExchange, fetchExchange],
  fetch: fetch,
});

const PositionsQuery = gql`
  query PositionsQuery($id: ID!, $timestamp_gt: BigInt) {
    positions(
      where: {
        pool_: { id: $id }
        transaction_: { timestamp_gt: $timestamp_gt }
      }
      first: 1000
      orderBy: transaction__timestamp
      orderDirection: asc
    ) {
      amountDepositedUSD
      collectedFeesToken0
      collectedFeesToken1
      id
      owner
      tickLower
      tickUpper
      pool {
        tick
      }
      transaction {
        timestamp
        blockNumber
      }
    }
  }
`;

const poolQuery = gql`
  query PoolQuery($pool: ID!) {
    pool(id: $pool) {
      token0 {
        symbol
        id
      }
      token1 {
        symbol
        id
      }
      sqrtPrice
      tick
      feeTier
    }
  }
`;

let lastPositionTimeStamp = "1620243731";
const positionCount = 1000000;
const network = "eth";

const getPositions = async (poolId, positionCount) => {
  const positions = [];

  for (let i = 0; i < positionCount; i += 1000) {
    try {
      const result = await client
        .query(PositionsQuery, {
          id: poolId,
          timestamp_gt: lastPositionTimeStamp,
        })
        .toPromise();

      const fetchedPositions = result?.data?.positions || [];
      if (fetchedPositions.length === 0) break;

      console.log(
        fetchedPositions[fetchedPositions.length - 1].transaction.timestamp
      );
      positions.push(...fetchedPositions);
      lastPositionTimeStamp =
        fetchedPositions[fetchedPositions.length - 1].transaction.timestamp;

      console.log("fetched!");
    } catch (error) {
      console.log("ERROR: ", error);
      break; // Exit loop on error
    }
  }
  console.log(positions.length);
  return positions;
};

const getPoolMetadata = async (poolId) => {
  const result = await client.query(poolQuery, { pool: poolId }).toPromise();
  if (result.error) throw new Error(result.error.message);
  if (!result.data || !result.data.pool) throw new Error("Pool data not found");

  const poolData = result.data.pool;

  // Placeholder for token prices
  const token0Price = 0;
  const token1Price = 0;

  return [
    poolData.tick,
    poolData.sqrtPrice,
    new BigNumber(token0Price).toFixed(5),
    new BigNumber(token1Price).toFixed(5),
    poolData.token0.symbol,
    poolData.token0.id,
    poolData.token1.symbol,
    poolData.token1.id,
    poolData.feeTier,
  ];
};

async function main(pool) {
  const positions = await getPositions(pool, positionCount);

  const now = new Date();
  const currentTimestamp = Math.floor(now.getTime() / 1000);
  const poolMetadata = await getPoolMetadata(pool);

  const data = [
    {
      "Pool Address": pool,
      "Token 0 Address": poolMetadata[5],
      "Token 1 Address": poolMetadata[7],
      Pool: poolMetadata[4].toString() + poolMetadata[6].toString(),
      CurrentTick: poolMetadata[0].toString(),
    },
    {},
    {
      Owner: "Owner",
      nftID: "nftID",
      "Tick Lower": "Tick Lower",
      "Tick Upper": "Tick Upper",
      "Timestamp Opened": "Timestamp Opened",
      "Block Opened": "Block Opened",
      Tick: "Tick",
      "Deposited USD": "Deposited USD",
      "Fees claimed USD": "Fees claimed USD",
      "Current timestamp": "Current timestamp",
    },
    ...positions.map((position) => {
      return {
        Owner: position.owner,
        nftID: position.id,
        "Tick Lower": position.tickLower,
        "Tick Upper": position.tickUpper,
        "Timestamp Opened": position.transaction?.timestamp || 0,
        "Block Opened": position.transaction?.blockNumber || 0,
        Tick: position.pool.tick,
        "Deposited USD": new BigNumber(position.amountDepositedUSD).toFixed(2),
        "Fees claimed USD": new BigNumber(position.collectedFeesToken0)
          .plus(position.collectedFeesToken1)
          .toFixed(2),
        "Current timestamp": currentTimestamp,
      };
    }),
  ];

  const csv = parse(data);
  const filename = `${poolMetadata[4]}_${poolMetadata[6]}_${poolMetadata[8]}_positions.csv`;

  const path = `${process.cwd()}/data/${network}/positions`;

  console.log({ path, filename });
  try {
    fs.mkdirSync(path, { recursive: true });
  } catch (err) {
    console.error("Directory creation failed: ", err);
  }
  try {
    fs.writeFileSync(path + filename, csv);
    console.log("CSV file written successfully");
  } catch (err) {
    console.error("File write failed: ", err);
  }
}

main(constants.ETH_pools.WETH_USDC.toLowerCase());
