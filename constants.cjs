const API_KEY = "ed8170fbbfb3d1664e55bd33efb99d71";

const ETH_QUERY_URL = `https://gateway-arbitrum.network.thegraph.com/api/${API_KEY}/deployments/id/QmZeCuoZeadgHkGwLwMeguyqUKz1WPWQYKcKyMCeQqGhsF`;
// const ETH_QUERY_URL = `https://gateway-arbitrum.network.thegraph.com/api/${API_KEY}/subgraphs/id/4cKy6QQMc5tpfdx8yxfYeb9TLZmgLQe44ddW1G7NwkA6`;
const BASE_QUERY_URL = `https://gateway-arbitrum.network.thegraph.com/api/${API_KEY}/subgraphs/id/FUbEPQw1oMghy39fwWBFY5fE6MXPXZQtjncQy2cXdrNS`;
const ARB_QUERY_URL = `https://gateway-arbitrum.network.thegraph.com/api/${API_KEY}/subgraphs/id/FQ6JYszEKApsBpAmiHesRsd9Ygc6mzmpNRANeVQFYoVX`;

const MESSARI_ETH_URL = `https://gateway-arbitrum.network.thegraph.com/api/${API_KEY}/subgraphs/id/4cKy6QQMc5tpfdx8yxfYeb9TLZmgLQe44ddW1G7NwkA6`;

const ETH_pools = {
    "USDC_USDT": "0x3416cF6C708Da44DB2624D63ea0AAef7113527C6",
    "USDT_DAI": "0x48DA0965ab2d2cbf1C17C09cFB5Cbe67Ad5B1406",
    "DAI_USDC": "0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168",
    "WETH_USDC": "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
    "WETH_USDT": "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
    "WETH_DAI": "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8",
}

// WBTC_USDC = 0x99ac8cA7087fA4A2A1FB6357269965A2014ABc35
//
//
//

const BASE_pools = {
    "USDC_USDT": "0xD56da2B74bA826f19015E6B7Dd9Dae1903E85DA1",
    // "USDT_DAI": "",
    "DAI_USDC": "0xC18F50d6A832f12F6DcAaeEe8D0c87A65B96787E",
    "WETH_USDC": "0xd0b53D9277642d899DF5C87A3966A349A798F224",
    "WETH_USDT": "0xd92E0767473D1E3FF11Ac036f2b1DB90aD0aE55F",
    "WETH_DAI": "0x93e8542E6CA0eFFfb9D57a270b76712b968A38f5",
}

const ARB_pools = {
    "USDC_USDT": "0xbE3aD6a5669Dc0B8b12FeBC03608860C31E2eef6",
    "USDT_DAI": "0x7f580f8A02b759C350E6b8340e7c2d4b8162b6a9",
    "DAI_USDC": "0xd37Af656Abf91c7f548FfFC0133175b5e4d3d5e6",
    "WETH_USDC": "0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443",
    "WETH_USDT": "0x641C00A822e8b671738d32a431a4Fb6074E5c79d",
    "WETH_DAI": "0xA961F0473dA4864C5eD28e00FcC53a3AAb056c1b",
}

// tokens (from uniswap)

const DAI = {
    "ETH": "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    "BASE": "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    "ARB": "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"
}

const WETH = {
    "ETH": "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
    "BASE": "0x4200000000000000000000000000000000000006",
    "ARB": "0x82af49447d8a07e3bd95bd0d56f35241523fbab1"
}

const USDC = {
    "ETH": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    "BASE": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    "ARB": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"
}

const USDT = {
    "ETH": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "BASE": "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
    "ARB": "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9"
}

module.exports = {
    API_KEY,
    ETH_QUERY_URL,
    BASE_QUERY_URL,
    ARB_QUERY_URL,
    ETH_pools,
    BASE_pools,
    ARB_pools,
    DAI,
    WETH,
    USDC,
    USDT,
    MESSARI_ETH_URL
}