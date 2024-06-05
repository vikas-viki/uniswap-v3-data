import { gql, Client, cacheExchange, fetchExchange } from "@urql/core";
import fetch from "node-fetch";
import { parse } from "json2csv";
import fs from "fs";
import * as constants from "./constants.cjs";
import * as temps from "./utils.js"
import { ethers } from "ethers";
import BigNumber from 'bignumber.js';

BigNumber.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

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

const getPositions = async (poolId, positionCount) => {
  const positions = [];
  let lastPositionTimeStamp = "0";

  for (let i = 0; i < positionCount; i += 1000) {
    try {
      const result = await client
        .query(PositionsQuery, { id: poolId, timestamp_gt: lastPositionTimeStamp })
        .toPromise();

      const fetchedPositions = result?.data?.positions || [];
      if (fetchedPositions.length === 0) break;

      console.log(fetchedPositions[fetchedPositions.length - 1].transaction.timestamp);
      positions.push(...fetchedPositions.map(position => position.id));
      lastPositionTimeStamp = fetchedPositions[fetchedPositions.length - 1].transaction.timestamp;

      console.log("fetched!");
    } catch (error) {
      console.log("ERROR: ", error);
      // Optionally handle error (e.g., retry, break loop, etc.)
      break; // Exit loop on error
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

const TICK_BASE = new BigNumber(1.0001);

function tickToPrice(tick) {
  return TICK_BASE.pow(tick);
}

const getPoolMetadata = async (poolId) => {
  const result = await client.query(poolQuery, { pool: poolId }).toPromise();
  if (result.error) throw new Error(result.error.message);
  if (!result.data || !result.data.pool) throw new Error("Pool data not found");

  const poolData = result.data.pool;
  // var sqrtPrice = new BigNumber(poolData.sqrtPrice.toString());

  const token0PriceResult = await client_Messari.query(PriceQuery, { id: poolData.token0.id.toLowerCase() }).toPromise();
  const token1PriceResult = await client_Messari.query(PriceQuery, { id: poolData.token1.id.toLowerCase() }).toPromise();

  if (token0PriceResult.error) throw new Error(token0PriceResult.error.message);
  if (token1PriceResult.error) throw new Error(token1PriceResult.error.message);

  const token0Price = token0PriceResult.data.token.lastPriceUSD;
  const token1Price = token1PriceResult.data.token.lastPriceUSD;

  return [
    poolData.tick,
    poolData.sqrtPrice,
    new BigNumber(token0Price).toFixed(5),
    new BigNumber(token1Price).toFixed(5),
    poolData.token0.symbol,
    poolData.token0.id,
    poolData.token1.symbol,
    poolData.token1.id
  ];
};


async function getCurrentLiquidityBalanceAmounts(positionId, poolTick, sqrtPrice) {
  const position = await getPositionInfo(positionId);

  const liquidity = new BigNumber(position.liquidity);
  const tickLower = new BigNumber(position.tickLower.tickIndex);
  const tickUpper = new BigNumber(position.tickUpper.tickIndex);

  const decimals0 = new BigNumber(position.token0.decimals);
  const decimals1 = new BigNumber(position.token1.decimals);

  const currentTick = new BigNumber(poolTick);
  const currentSqrtPrice = new BigNumber(sqrtPrice);

  const sa = tickToPrice(tickLower.div(2));
  const sb = tickToPrice(tickUpper.div(2));

  let amount0, amount1;

  if (tickUpper.lte(currentTick)) {
    // Only token1 locked
    amount0 = new BigNumber(0);
    amount1 = liquidity.times(sb.minus(sa));
  } else if (tickLower.lt(currentTick) && currentTick.lt(tickUpper)) {
    // Both tokens present
    amount0 = liquidity.times(sb.minus(currentSqrtPrice)).div(currentSqrtPrice.times(sb));
    amount1 = liquidity.times(currentSqrtPrice.minus(sa));
  } else {
    // Only token0 locked
    amount0 = liquidity.times(sb.minus(sa)).div(sa.times(sb));
    amount1 = new BigNumber(0);
  }

  // Print info about the position
  const adjustedAmount0 = amount0.div(new BigNumber(10).pow(decimals0));
  const adjustedAmount1 = amount1.div(new BigNumber(10).pow(decimals1));

  return [adjustedAmount0.toString(), adjustedAmount1.toString(), decimals0.toString(), decimals1.toString()];
}

async function getTimeStamps(tickLower, tickUpper, owner, pool, liquidity) {
  var variables = { index: tickUpper, index1: tickLower, liquidity: liquidity, id: owner, id1: pool };
  var result = await client_Messari.query(PositionTimeStampQuery, variables);

  return [result.data.positions[0]?.timestampOpened, result.data.positions[0]?.timestampClosed == null ? Math.floor(Date.now() / 1000) : result.data.positions[0]?.timestampClosed];
}

/*
APR
*/
const getPositionDetails = async (poolAddress, positionId, poolTick, sqrtPrice, token0Price, token1Price) => {

  var positionDetails = (await client.query(PositionDetailsQuery, { id: positionId }).toPromise()).data.position;

  var currentLiquidityBalanceAmounts = await getCurrentLiquidityBalanceAmounts(positionId, poolTick, sqrtPrice);

  var timeStamps = await getTimeStamps(positionDetails.tickLower, positionDetails.tickUpper, positionDetails.owner, poolAddress, positionDetails.liquidity);

  console.log("currentLiquidityBalanceAmounts: ", currentLiquidityBalanceAmounts);
  var currentLiquidityUSD = (Number(currentLiquidityBalanceAmounts[0]) * token0Price) + (Number(currentLiquidityBalanceAmounts[1]) * token1Price);

  var currentAccruedFees = await temps.getCurrentAccruedFees(positionId, positionDetails.owner);

  let currentFeeAmount0 = Number(ethers.utils.formatUnits(currentAccruedFees[0], Number(currentLiquidityBalanceAmounts[2]))).toFixed(5);
  let currentFeeAmount1 = Number(ethers.utils.formatUnits(currentAccruedFees[1], Number(currentLiquidityBalanceAmounts[3]))).toFixed(5);

  var uncollectedFeesUSD = (currentFeeAmount0 * token0Price) + (currentFeeAmount1 * token1Price);
  var collectedFeesUSD = (Number(positionDetails.collectedFeesToken0) * token0Price) + (Number(positionDetails.collectedFeesToken1) * token1Price);

  let totalDepositUSd = (Number(positionDetails.depositedToken0).toFixed(5) * token0Price) + (Number(positionDetails.depositedToken1).toFixed(5) * token1Price);
  let totalWithdrawnUSd = (Number(positionDetails.withdrawnToken0).toFixed(5) * token0Price) + (Number(positionDetails.withdrawnToken1).toFixed(5) * token1Price);

  var pnl = currentLiquidityUSD - totalDepositUSd + totalWithdrawnUSd + uncollectedFeesUSD + collectedFeesUSD;


  return {
    nftID: positionId,
    address: positionDetails.owner,
    tickUpper: positionDetails.tickUpper,
    tickLower: positionDetails.tickLower,
    totalDepositUSd: totalDepositUSd,
    currentLiquidityUSD,
    feesClaimedUSD: collectedFeesUSD,
    unclaimedFeesUSD: uncollectedFeesUSD,
    pnl,
    timestampOpened: timeStamps[0],
    timestampClosed: timeStamps[1]
  }
}

const getPositionsAndDetails = async (poolAddress) => {
  var currentTimeStamp = Math.floor(Date.now() / 1000);
  var poolMetadata = await getPoolMetadata(poolAddress);

  console.log("GOT POOL METADATA");

  var positionIds = await getPositions(poolAddress, '1000');

  console.log("GOT POSITIONS: ", positionIds.length);

  var positionDetails = [];

  for (let i = 0; i < positionIds.length; i++) {
    var positionDetail = await getPositionDetails(poolAddress, positionIds[i], Number(poolMetadata[0]), Number(poolMetadata[1]), poolMetadata[2], poolMetadata[3], currentTimeStamp);
    console.log(positionDetail);
    positionDetails.push(positionDetail);
  }
  console.log("GOT ALL THE DETAILS");
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
      'nftID': 'nftID',
      'Tick Lower': 'Tick Lower',
      'Tick Upper': 'Tick Upper',
      'Timestamp Closed': 'Timestamp Closed',
      'Timestamp Opened': 'Timestamp Opened',
      'Current liquidity USD': 'Current liquidity USD',
      'Deposited USD': 'Deposited USD',
      'Fees claimed USD': 'Fees claimed USD',
      'Fees unclaimed USD': 'Fees unclaimed USD',
      'Current timestamp': 'Current timestamp',
      'PNL': 'PNL'
    },
    ...positionDetails.map(position => ({
      'Account': position.address,
      'nftID': position.nftID,
      'Tick Lower': position.tickLower,
      'Tick Upper': position.tickUpper,
      'Timestamp Closed': position.timestampClosed,
      'Timestamp Opened': position.timestampOpened,
      'Current liquidity USD': position.currentLiquidityUSD,
      'Deposited USD': position.totalDepositUSd,
      'Fees claimed USD': position.feesClaimedUSD,
      'Fees unclaimed USD': position.unclaimedFeesUSD,
      'Current timestamp': currentTimeStamp,
      'PNL': position.pnl
    }))
  ];

  const csv = parse(data);
  const filePath = poolMetadata[4].toString() + '_' + poolMetadata[6].toString() + '_positions.csv';
  fs.writeFileSync(filePath, csv);

  console.log('CSV file written successfully');

};

(async () => {
  const poolAddress = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640".toLowerCase();
  await getPositionsAndDetails(poolAddress);
})();