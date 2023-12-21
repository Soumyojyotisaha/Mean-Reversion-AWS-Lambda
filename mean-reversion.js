//AWS Lambda Function that implements mean reversion strategy in Node.js:

const KiteConnect = require('kiteconnect').KiteConnect;
const moment = require('moment');

const kite = new KiteConnect({
  api_key: 'YOUR_API_KEY',
});

const LOOKBACK_PERIOD = 20; // The number of days to look back for the mean reversion calculation
const MEAN_REVERSION_THRESHOLD = 2; // The number of standard deviations away from the mean to trigger a trade

// Function to calculate the mean and standard deviation of a given array of prices
function calculateMeanAndStdDev(prices) {
  const mean = prices.reduce((total, price) => total + price, 0) / prices.length;
  const stdDev = Math.sqrt(prices.reduce((total, price) => total + Math.pow(price - mean, 2), 0) / prices.length);
  return { mean, stdDev };
}

// Function to check if the current price is more than MEAN_REVERSION_THRESHOLD standard deviations away from the mean
function isMeanReversionTriggered(prices) {
  const { mean, stdDev } = calculateMeanAndStdDev(prices);
  const currentPrice = prices[prices.length - 1];
  const threshold = mean + MEAN_REVERSION_THRESHOLD * stdDev;
  return currentPrice > threshold;
}

// Function to get the historical prices for the specified symbol and lookback period
async function getHistoricalPrices(symbol) {
  try{
  const today = moment().format('YYYY-MM-DD');
  const lookbackDate = moment().subtract(LOOKBACK_PERIOD, 'days').format('YYYY-MM-DD');
  const { data: bars } = await kite.historicalData({
    instrument_token: symbol,
    from: lookbackDate,
    to: today,
    interval: 'day',
  });
  const prices = bars.map(bar => bar.close);
  return prices;
  }catch(err){
   return err;
  }
}

// Function to execute a buy order for the specified symbol
async function buy(symbol) {
  try{
  const order = await kite.placeOrder('regular', {
    tradingsymbol: symbol,
    quantity: 1,
    exchange: 'NSE',
    transaction_type: 'BUY',
    order_type: 'MARKET',
    product: 'MIS',
  });
  console.log(`Bought 1 share of ${symbol} at ${order.average_price}`);
  }catch(err){
     return err;
  }
}

// Function to execute a sell order for the specified symbol
async function sell(symbol) {
try{
  const order = await kite.placeOrder('regular', {
    tradingsymbol: symbol,
    quantity: 1,
    exchange: 'NSE',
    transaction_type: 'SELL',
    order_type: 'MARKET',
    product: 'MIS',
  });
  console.log(`Sold 1 share of ${symbol} at ${order.average_price}`);
}catch(err){
     return err;
  }
}

// Main function to run the mean reversion strategy
exports.handler = async (event, context) => {
 try{
  const watchlist = ['SBIN']; // The symbol of the stock we're trading
  
  const session = await kite.generateSession("request_token", "api_secret");
  
  await Promise.all(watchlist.map(async (symbol) => {
  const prices = await getHistoricalPrices(symbol);
  
  if (isMeanReversionTriggered(prices)) {
    const position = await kite.getPositions();
    const sbinPosition = position.net.find(p => p.tradingsymbol === symbol);
    if (!sbinPosition) {
      await buy(symbol);
    } else if (sbinPosition.quantity <= 0) {
      await buy(symbol);
    } else {
      await sell(symbol);
    }
  }
  }));
  
  console.log("Successfully executed.");
 }catch(err){
   console.log(err);
 }
};
