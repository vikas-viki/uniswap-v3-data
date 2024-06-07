import { gql, Client, cacheExchange, fetchExchange } from "@urql/core";
import fetch from "node-fetch";
import * as XLSX from 'xlsx';
import * as constants from "./constants.cjs";


const BIPS_BASE = 10000;

const client = new Client({
  url: constants.RF_ETH,
  exchanges: [cacheExchange, fetchExchange],
  fetch: fetch,
});

const trxnQuery = gql`
query MyQuery($pool: ID!) {
  poolDayDatas(
    orderBy: date
    orderDirection: desc
    first: 365
    where: {pool_: {id: $pool}}
  ) {
    volumeUSD
    tvlUSD
    volumeToken1
    volumeToken0
    token0Price
    token1Price
    date
    pool {
      feeTier
      token1 {
        symbol
      }
      token0 {
        symbol
      }
    }
  }
}
`;

function calculateOneDayApr(volume24h, tvl, feeTier) {
  return (volume24h * (feeTier / BIPS_BASE)) / tvl * 100;
}

function getDate(timeStamp) {
  const blockchainTimestamp = timeStamp;

  const date = new Date(blockchainTimestamp * 1000).toISOString();

  return date;
}

const getPoolData = async (poolAddress, network) => {
  const poolId = poolAddress;
  const result = await client.query(trxnQuery, { pool: poolId }).toPromise();

  const poolData = result.data.poolDayDatas;

  const feeTier = poolData[0].pool.feeTier;

  var poolname = poolData[0].pool.token0.symbol + "_" + poolData[0].pool.token1.symbol + "_" + feeTier;

  const data = [
    { A: 'name', B: poolname },
    { A: 'totalValueLocked ($)', B: Math.round(poolData[0].tvlUSD) },
    { A: 'fees', B: feeTier },
    { A: 'Day', B: 'Volume ($)', C: 'TVL ($)', D: 'APR (%)', E: 'Fee Earned ($)' },
    ...poolData.map(snapshot => {
      var dailyVolumeUSD = Number(snapshot.volumeUSD);
      if (dailyVolumeUSD == 0) {
        var volumeToken0 = Number(snapshot.volumeToken0) * Number(snapshot.token0Price);
        var volumeToken1 = Number(snapshot.volumeToken1) * Number(snapshot.token1Price);
        dailyVolumeUSD = Math.round(volumeToken0 + volumeToken1);
      }

      var totalValueLockedUSD = Math.round(Number(snapshot.tvlUSD));

      var oneDayAPR = calculateOneDayApr(dailyVolumeUSD, totalValueLockedUSD, feeTier);

      var oneDayFeeEarned = dailyVolumeUSD * (feeTier / 1000000);

      const actualDate = getDate(Number(snapshot.date));

      return {
        A: actualDate.split('T')[0],
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
  XLSX.writeFile(workbook, `data/${network}_POOLS/${network}_${poolname}.xlsx`);

  console.log('Excel file written successfully');
};

const getAllPoolsData = async () => {
  for (const key in constants.ETH_pools) {
    await getPoolData(constants.ETH_pools[key].toLowerCase(), "ETH");
  }
}

getAllPoolsData();
