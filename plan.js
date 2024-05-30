// pick a particular pool with data (WETH/USDC)
// query
/*
    pool(id: "0xc7bbec68d12a0d1830360f8ec58fa599ba1b0e9b") {
    token0 {
      id // to get tokens price
    }
    token1 {
      id
    }
    sqrtPrice
    tick
  }
*/

// get tokens price from messari
// query
/*
  token(id: "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2") {
    lastPriceUSD
  }
*/


// get all its positions with position NFTid
// -- query repeatedly to store all positions
/*
positions(
    where: {pool_: {id: "0xc7bbec68d12a0d1830360f8ec58fa599ba1b0e9b"}}
    first: 1000
  ) {
    id
  }
*/


// get data from revert finance subgraph
// query
/*
  position(id: "698036") {
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
*/


// --- calculate current liquidity balance like getPositionsData_py.js
// --- query
/*
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
*/


// --- use rest every data as it provides
// --- call npfm, to get current un claimed fees for open ositions.

// then calculate pnl and all