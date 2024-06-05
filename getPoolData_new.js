import { gql, Client, cacheExchange, fetchExchange } from "@urql/core";
import fetch from "node-fetch";
import * as XLSX from 'xlsx';
import * as constants from "./constants.cjs";

const BIPS_BASE = 10000;

const client = new Client({
  url: constants.NEW_URL_BASE,
  exchanges: [cacheExchange, fetchExchange],
  fetch: fetch,
});

const trxnQuery = gql`
query MyQuery($pool: ID!) {
  pool(id: $pool) {
    poolDayData(orderBy: date, orderDirection: desc, first: 365) {
      tvlUSD
      volumeUSD
      date
      feesUSD
    }
    id
    liquidity
    feeTier
    token0 {
      symbol
    }
    token1 {
      symbol
    }
  }
}
`;

function calculateOneDayApr(volume24h, tvl, feeTier) {
  return (volume24h * (feeTier / BIPS_BASE)) / tvl * 100;
}

const getPoolData = async (poolAddress, network) => {
  const poolId = poolAddress;
  const result = await client.query(trxnQuery, { pool: poolId }).toPromise();

  const poolData = result.data.pool;
  const feeTier = poolData.feeTier;

  const data = [
    { A: 'name', B: `${poolData.token0.symbol}/${poolData.token1.symbol}_${feeTier}` },
    { A: 'totalValueLocked ($)', B: Math.round(poolData.poolDayData[0].tvlUSD) },
    { A: 'fees', B: feeTier },
    { A: 'Day', B: 'Volume ($)', C: 'TVL ($)', D: 'APR (%)', E: 'Fee Earned ($)' },
    ...poolData.poolDayData.map(snapshot => {
      const dailyVolumeUSD = Math.round(snapshot.volumeUSD);
      const totalValueLockedUSD = Math.round(snapshot.tvlUSD);
      const oneDayAPR = calculateOneDayApr(dailyVolumeUSD, totalValueLockedUSD, feeTier);
      const oneDayFeeEarned = snapshot.feesUSD;

      const actualDate = new Date(snapshot.date * 1000).toISOString().split('T')[0];

      return {
        A: actualDate,
        B: dailyVolumeUSD,
        C: totalValueLockedUSD,
        D: oneDayAPR.toFixed(2),
        E: oneDayFeeEarned
      };
    })
  ];

  const worksheet = XLSX.utils.json_to_sheet(data, { header: ["A", "B", "C", "D", "E"], skipHeader: true });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'PoolData');
  var name = `${poolData.token0.symbol}_${poolData.token1.symbol}`;
  XLSX.writeFile(workbook, `data/${network}_POOLS/${network}_${name}.xlsx`);

  console.log('Excel file written successfully');
};

const getAllPoolsData = async () => {
  for (const key in constants.BASE_pools) {
    await getPoolData(constants.BASE_pools[key].toLowerCase(), "BASE");
  }
}

getAllPoolsData();
