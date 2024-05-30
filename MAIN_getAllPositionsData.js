import { gql, Client, cacheExchange, fetchExchange } from "@urql/core";
import fetch from "node-fetch";
import { parse } from "json2csv";
import fs from "fs";
import * as constants from "./constants.cjs";
import { getCurrentAccruedFees } from "./temp.js"
import { ethers } from "ethers";

const client = new Client({
  url: constants.ETH_QUERY_URL,
  exchanges: [cacheExchange, fetchExchange],
  fetch: fetch
});


const client_Messari = new Client({
  url: constants.MESSARI_ETH_URL,
  exchanges: [cacheExchange, fetchExchange],
  fetch: fetch
});

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
    }
  }
`;

const PriceQuery = gql`
  query PriceQuery($id: ID!){
    token(id: $id) {
        lastPriceUSD
      }
  }
`;

const PositionsQuery = gql`
  query PositionsQuery($id: ID!, $timestamp_gt: BigInt){
    positions(
        where: {pool_: {id: $id}, transaction_: {timestamp_gt: $timestamp_gt}}
        first: 1000
        orderBy: transaction__timestamp
        orderDirection: asc
      ) {
        id
        transaction {
            timestamp
        }
      }
  }
`;

const PositionDetailsQuery = gql`
  query PositionDetailsQuery($id: ID!){
    position(id: $id) {
      amountCollectedUSD
      amountDepositedUSD
      amountWithdrawnUSD
      collectedFeesToken0
      collectedFeesToken1
      collectedToken0
      collectedToken1
      depositedToken0
      depositedToken1
      feeGrowthInside0LastX128
      feeGrowthInside1LastX128
      id
      liquidity
      owner
      tickLower
      tickUpper
      withdrawnToken0
      withdrawnToken1
      pool {
        id
      }
    }
  }
`;

const PositionInfoQuery = gql`
  query get_position($position_id: ID!) {
    positions(where: { id: $position_id }) {
      liquidity
      tickLower {
        tickIdx
      }
      tickUpper {
        tickIdx
      }
      pool { id }
      token0 {
        symbol
        decimals
      }
      token1 {
        symbol
        decimals
      }
    }
  }
`;

const PositionTimeStampQuery = gql`
  query MyQuery($index: BigInt, $index1: BigInt, $liquidity: BigInt, $id: Bytes, $id1: Bytes) {
    positions(
      where: {account_: {id: $id}, tickUpper_: {index: $index}, tickLower_: {index: $index1}, liquidity: $liquidity, pool_: {id: $id1}}
    ) {
      timestampClosed
      timestampOpened
      liquidity
    }
  }
`;

const TICK_BASE = 1.0001;

function tickToPrice(tick) {
  return Math.pow(TICK_BASE, tick);
}

const getPoolMetadata = async (poolId) => {
  const result = await client.query(poolQuery, { pool: poolId }).toPromise();

  const token0Price = await client_Messari.query(PriceQuery, { id: result.data.pool.token0.id });
  const token1Price = await client_Messari.query(PriceQuery, { id: result.data.pool.token1.id });

  return [
    result.data.pool.tick,
    result.data.pool.sqrtPrice,
    token0Price.data.token.lastPriceUSD,
    token1Price.data.token.lastPriceUSD,
    result.data.pool.token0.symbol,
    result.data.pool.token0.id,
    result.data.pool.token1.symbol,
    result.data.pool.token1.id
  ];
};

const getPositions = async (poolId, positionCount) => {
  const positions = [];
  let lastPositionTimeStamp = "0";

  for (let i = 0; i < positionCount; i += 1000) {
    try {
      const result = await client
        .query(PositionsQuery, { id: poolId, timestamp_gt: lastPositionTimeStamp })
        .toPromise();

      const fetchedPositions = result?.data?.positions;
      if (!fetchedPositions.length) break;

      positions.push(...fetchedPositions.id);
      lastTimestampOpened = fetchedPositions[fetchedPositions.length - 1].transaction.timestamp;

      console.log("fetched!");
    } catch (error) {
      console.log("ERROR");
    }
  }

  return positions;
};

async function getPositionInfo(positionId) {
  try {
    const variables = { position_id: positionId };
    const response = await client.query(PositionInfoQuery, variables).toPromise();

    if (response.error) throw response.error;
    if (response.data.positions.length === 0) {
      console.log("position not found");
    }

    return response.data.positions[0];
  } catch (error) {
    console.error("got exception while querying position data:", error);
    process.exit(-1);
  }
}

async function getCurrentLiquidityBalanceAmounts(positionId, poolTick, sqrtPrice) {

  const position = await getPositionInfo(positionId);

  const liquidity = parseInt(position.liquidity);
  const tickLower = parseInt(position.tickLower.tickIdx);
  const tickUpper = parseInt(position.tickUpper.tickIdx);

  const decimals0 = parseInt(position.token0.decimals);
  const decimals1 = parseInt(position.token1.decimals);

  const currentTick = poolTick;
  const currentSqrtPrice = sqrtPrice;

  const sa = tickToPrice(tickLower / 2);
  const sb = tickToPrice(tickUpper / 2);

  let amount0, amount1;

  if (tickUpper <= currentTick) {
    // Only token1 locked
    amount0 = 0;
    amount1 = liquidity * (sb - sa);
  } else if (tickLower < currentTick && currentTick < tickUpper) {
    // Both tokens present
    amount0 = liquidity * (sb - currentSqrtPrice) / (currentSqrtPrice * sb);
    amount1 = liquidity * (currentSqrtPrice - sa);
  } else {
    // Only token0 locked
    amount0 = liquidity * (sb - sa) / (sa * sb);
    amount1 = 0;
  }

  // Print info about the position
  const adjustedAmount0 = amount0 / Math.pow(10, decimals0);
  const adjustedAmount1 = amount1 / Math.pow(10, decimals1);

  return [adjustedAmount0, adjustedAmount1, decimals0, decimals1];
}

async function getTimeStamps(tickLower, tickUpper, owner, pool, liquidity) {
  var variables = { index: tickUpper, index1: tickLower, liquidity: liquidity, id: owner, id1: pool };
  var result = await client_Messari.query(PositionTimeStampQuery, variables);

  return [result.data.positions[0].timestampOpened, result.data.positions[0].timestampClosed];
}

/*
APR
*/
const getPositionDetails = async (poolAddress, positionId, poolTick, sqrtPrice, token0Price, token1Price) => {
  var positionDetails = (await client.query(PositionDetailsQuery, { id: positionId }).toPromise()).data.position;

  var currentLiquidityBalanceAmounts = await getCurrentLiquidityBalanceAmounts(positionId, poolTick, sqrtPrice);

  var currentLiquidityUSD = (currentLiquidityBalanceAmounts[0] * token0Price) + (currentLiquidityBalanceAmounts[1] * token1Price);

  var currentAccruedFees = await getCurrentAccruedFees(positionId, positionDetails.owner);

  let currentFeeAmount0 = Number(ethers.utils.formatUnits(currentAccruedFees[0], currentLiquidityBalanceAmounts[2])).toFixed(5);
  let currentFeeAmount1 = Number(ethers.utils.formatUnits(currentAccruedFees[1], currentLiquidityBalanceAmounts[3])).toFixed(5);

  var uncollectedFeesUSD = (currentFeeAmount0 * token0Price) + (currentFeeAmount1 * token1Price);
  var collectedFeesUSD = (Number(positionDetails.collectedFeesToken0) * token0Price) + (Number(positionDetails.collectedFeesToken1) * token1Price);

  let totalDepositUSd = (Number(positionDetails.depositedToken0).toFixed(5) * token0Price) + (Number(positionDetails.depositedToken1).toFixed(5) * token1Price);
  let totalWithdrawnUSd = (Number(positionDetails.withdrawnToken0).toFixed(5) * token0Price) + (Number(positionDetails.withdrawnToken1).toFixed(5) * token1Price);

  var pnl = currentLiquidityUSD - totalDepositUSd + totalWithdrawnUSd + uncollectedFeesUSD + collectedFeesUSD;

  var timeStamps = await getTimeStamps(positionDetails.tickLower, positionDetails.tickUpper, positionDetails.owner, poolAddress, positionDetails.liquidity);

  return {
    address: positionDetails.owner,
    tickUpper: positionDetails.tickUpper,
    tickLower: positionDetails.tickLower,
    currentLiquidityUSD,
    feesClaimedUSD: collectedFeesUSD,
    unclaimedFeesUSD: uncollectedFeesUSD,
    pnl,
    timestampOpened: timeStamps[0],
    timestampClosed: timeStamps[1] || Math.floor(Date.now() / 1000)
  }
}

const getPositionsAndDetails = async (poolAddress) => {
  var poolMetadata = await getPoolMetadata(poolAddress);

  var positionIds = await getPositions(poolAddress, '5000');

  var positionDetails = [];

  for (let i = 0; i < positionIds.length; i++) {
    var positionDetail = await getPositionDetails(poolAddress, positionIds[i], Number(poolMetadata[0]), Number(poolMetadata[1]));

    positionDetails.push(positionDetail);
  }

  var data = [
    {
      'Pool Address': poolAddress,
      'Token 0 Address': poolMetadata[5],
      'Token 1 Address': poolMetadata[7],
      'Pool': poolMetadata[4].toString() + poolMetadata[6].toString()
    },
    {},
    {
      'Account': 'Account',
      'Tick Lower': 'Tick Lower',
      'Tick Upper': 'Tick Upper',
      'Timestamp Closed': 'Timestamp Closed',
      'Timestamp Opened': 'Timestamp Opened',
      'Current liquidity USD': 'Current liquidity USD',
      'Fees claimed': 'Fees claimed',
      'Fees unclaimed': 'Fees unclaimed',
      "PNL": "PNL"
    },
    ...positionDetails.map(position => ({
      'Account': position.address,
      'Tick Lower': position.tickLower,
      'Tick Upper': position.tickUpper,
      'Timestamp Closed': position.timestampClosed,
      'Timestamp Opened': position.timestampOpened,
      'Current liquidity USD': position.currentLiquidityUSD,
      'Fees claimed': position.feesClaimedUSD,
      'Fees unclaimed': position.unclaimedFeesUSD,
      "PNL": position.pnl
    }))
  ];


  const csv = parse(data);
  const filePath = poolMetadata[4].toString() + '_' + poolMetadata[6].toString() + '_positions.csv';
  fs.writeFileSync(filePath, csv);

  console.log('CSV file written successfully');
};

(async () => {
  const poolAddress = "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8";
  await getPositionsAndDetails(poolAddress);
})();