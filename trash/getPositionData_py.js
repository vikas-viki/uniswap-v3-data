#!/usr/bin/env node

import { gql, Client, cacheExchange, fetchExchange } from "@urql/core";
import fetch from "node-fetch";
import * as constants from "../constants.cjs";

// Position ID to query
let POSITION_ID = "687682";

const TICK_BASE = 1.0001;

const positionQuery = gql`
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

const poolQuery = gql`
  query get_pools($pool_id: ID!) {
    pools(where: { id: $pool_id }) {
      tick
      sqrtPrice
    }
  }
`;

function tickToPrice(tick) {
  return Math.pow(TICK_BASE, tick);
}

const client = new Client({
  url: constants.ETH_QUERY_URL,
  exchanges: [cacheExchange, fetchExchange],
  fetch: fetch,
});

// Get position info
async function getPositionInfo() {
  try {
    const variables = { position_id: POSITION_ID };
    const response = await client.query(positionQuery, variables).toPromise();

    if (response.error) throw response.error;
    if (response.data.positions.length === 0) {
      console.log("position not found");
      process.exit(-1);
    }

    return response.data.positions[0];
  } catch (error) {
    console.error("got exception while querying position data:", error);
    process.exit(-1);
  }
}

// Get pool info for current price
async function getPoolInfo(pool_id) {
  try {
    const variables = { pool_id: pool_id };
    const response = await client.query(poolQuery, variables).toPromise();

    if (response.error) throw response.error;
    if (response.data.pools.length === 0) {
      console.log("pool not found");
      process.exit(-1);
    }

    return response.data.pools[0];
  } catch (error) {
    console.error("got exception while querying pool data:", error);
    process.exit(-1);
  }
}

async function main() {
  const position = await getPositionInfo();
  const liquidity = parseInt(position.liquidity);
  const tickLower = parseInt(position.tickLower.tickIdx);
  const tickUpper = parseInt(position.tickUpper.tickIdx);
  const pool_id = position.pool.id;

  const token0 = position.token0.symbol;
  const token1 = position.token1.symbol;
  const decimals0 = parseInt(position.token0.decimals);
  const decimals1 = parseInt(position.token1.decimals);

  const pool = await getPoolInfo(pool_id);
  const currentTick = parseInt(pool.tick);
  const currentSqrtPrice = parseInt(pool.sqrtPrice) / Math.pow(2, 96);

  // Compute and print the current price
  const currentPrice = tickToPrice(currentTick);
  const adjustedCurrentPrice = currentPrice / Math.pow(10, decimals1 - decimals0);
  console.log(`Current price=${adjustedCurrentPrice.toFixed(6)} ${token1} for ${token0} at tick ${currentTick}`);

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
  console.log(`  position ${POSITION_ID} in range [${tickLower},${tickUpper}]: ${adjustedAmount0.toFixed(6)} ${token0} and ${adjustedAmount1.toFixed(6)} ${token1} at the current price`);
}

main();
