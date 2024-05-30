import { gql, Client, cacheExchange, fetchExchange } from "@urql/core";
import fetch from "node-fetch";
import * as XLSX from 'xlsx';
import * as constants from "./constants.cjs";


const BIPS_BASE = 10000;

const client = new Client({
  url: constants.BASE_QUERY_URL,
  exchanges: [cacheExchange, fetchExchange],
  fetch: fetch,
});

const trxnQuery = gql`
query MyQuery($pool: ID!) {
  liquidityPool(id: $pool) {
    name
    symbol
    totalValueLockedUSD
    dailySnapshots(orderBy: day, orderDirection: desc, first: 365) {
      day
      dailyVolumeUSD
      totalValueLockedUSD
    }
    fees(where: {feeType: FIXED_LP_FEE}) {
      feePercentage
    }
  }
}
`;

function calculateOneDayApr(volume24h, tvl, feeTier) {
  return (volume24h * (feeTier / BIPS_BASE)) / tvl * 100;
}

const currentDate = new Date();

const getPoolData = async (poolAddress, network) => {
  const poolId = poolAddress;
  const result = await client.query(trxnQuery, { pool: poolId }).toPromise();

  const poolData = result.data.liquidityPool;
  const feeTier = poolData.fees[0].feePercentage * 10000;
  const currentDay = poolData.dailySnapshots[0].day + 1;

  const data = [
    { A: 'name', B: poolData.name },
    { A: 'totalValueLocked ($)', B: Math.round(poolData.totalValueLockedUSD) },
    { A: 'fees', B: feeTier },
    { A: 'Day', B: 'Volume ($)', C: 'TVL ($)', D: 'APR (%)', E: 'Fee Earned ($)' },
    ...poolData.dailySnapshots.map(snapshot => {
      const dailyVolumeUSD = Math.round(snapshot.dailyVolumeUSD);
      const totalValueLockedUSD = Math.round(snapshot.totalValueLockedUSD);
      const oneDayAPR = calculateOneDayApr(dailyVolumeUSD, totalValueLockedUSD, feeTier);
      const oneDayFeeEarned = dailyVolumeUSD * (feeTier / 1000000);

      const actualDate = new Date(currentDate);
      actualDate.setDate(currentDate.getDate() - (currentDay - snapshot.day));

      return {
        A: actualDate.toISOString().split('T')[0],
        B: dailyVolumeUSD,
        C: totalValueLockedUSD,
        D: oneDayAPR.toFixed(2),
        E: oneDayFeeEarned
      };
    })
  ];

  const worksheet = XLSX.utils.json_to_sheet(data, { header: ["A", "B", "C", "D"], skipHeader: true });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'PoolData');
  var name = poolData.symbol.split(" ").join("").replace("/", "_");
  XLSX.writeFile(workbook, `${network}_POOLS/${network}_${name}.xlsx`);

  console.log('Excel file written successfully');
};

const getAllPoolsData = async () => {
  for (const key in constants.BASE_pools) {
    await getPoolData(constants.BASE_pools[key], "BASE");
  }
}

getAllPoolsData();
/**
 * TVL
$14.1M
0.25%
24H volume
$27.2M
78.67%
24H fees
$13.6K


query MyQuery {
  positions(where: {owner: "0xdd95f2e27c7660785bde0e24d779a0c658f93fe3"}) {
    amountCollectedUSD
    amountDepositedUSD
    transaction {
      mints {
        timestamp
        tickUpper
        tickLower
      }
      burns {
        timestamp
        tickUpper
      }
      collects {
        amountUSD
      }
    }
    pool {
      tick
      token0 {
        name
      }
      token1 {
        name
      }
    }
    owner
    collectedFeesToken0
    withdrawnToken0
    withdrawnToken1
    collectedFeesToken1
  }
}
 */