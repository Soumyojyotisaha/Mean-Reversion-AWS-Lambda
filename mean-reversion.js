// Import necessary libraries
const KiteConnect = require('kiteconnect').KiteConnect;
const moment = require('moment');

// Initialize the KiteConnect instance with your API key
const kite = new KiteConnect({
  api_key: 'YOUR_API_KEY',
});

// Define constants
const LOOKBACK_PERIOD = 20; // Number of days to look back for the mean reversion calculation
const MEAN_REVERSION_THRESHOLD = 2; // Number of standard deviations away from the mean to trigger a trade

// Function to calculate the mean and standard deviation of a given array of prices
function calculateMeanAndStdDev(prices) {
  // Calculate the mean price
  const mean = prices.reduce((total, price) => total + price, 0) / prices.length;
  // Calculate the standard deviation
  const stdDev = Math.sqrt(prices.reduce((total, price) => total + Math.pow(price - mean, 2), 0) / prices.length);
  // Return the mean and standard deviation
  return { mean, stdDev };
}

// Function to check if the current price is more than MEAN_REVERSION_THRESHOLD standard deviations away from the mean
function isMeanReversionTriggered(prices) {
  // Calculate the mean and standard deviation of the prices
  const { mean, stdDev } = calculateMeanAndStdDev(prices);
  // Get the most recent price
  const currentPrice = prices[prices.length - 1];
  // Calculate the threshold price
  const threshold = mean + MEAN_REVERSION_THRESHOLD * stdDev;
  // Return true if the current price is above the threshold
  return currentPrice > threshold;
}

// Function to get the historical prices for the specified symbol and lookback period
async function getHistoricalPrices(symbol) {
  try {
    // Get today's date and the lookback date
    const today = moment().format('YYYY-MM-DD');
    const lookbackDate = moment().subtract(LOOKBACK_PERIOD, 'days').format('YYYY-MM-DD');
    // Fetch historical data from the KiteConnect API
    const { data: bars } = await kite.historicalData({
      instrument_token: symbol,
      from: lookbackDate,
      to: today,
      interval: 'day',
    });
    // Extract the closing prices from the historical data
    const prices = bars.map(bar => bar.close);
    // Return the array of prices
    return prices;
  } catch (err) {
    // Return any error encountered
    return err;
  }
}

// Function to execute a buy order for the specified symbol
async function buy(symbol) {
  try {
    // Place a buy order using the KiteConnect API
    const order = await kite.placeOrder('regular', {
      tradingsymbol: symbol,
      quantity: 1,
      exchange: 'NSE',
      transaction_type: 'BUY',
      order_type: 'MARKET',
      product: 'MIS',
    });
    // Log the successful buy order
    console.log(`Bought 1 share of ${symbol} at ${order.average_price}`);
  } catch (err) {
    // Return any error encountered
    return err;
  }
}

// Function to execute a sell order for the specified symbol
async function sell(symbol) {
  try {
    // Place a sell order using the KiteConnect API
    const order = await kite.placeOrder('regular', {
      tradingsymbol: symbol,
      quantity: 1,
      exchange: 'NSE',
      transaction_type: 'SELL',
      order_type: 'MARKET',
      product: 'MIS',
    });
    // Log the successful sell order
    console.log(`Sold 1 share of ${symbol} at ${order.average_price}`);
  } catch (err) {
    // Return any error encountered
    return err;
  }
}

// Main function to run the mean reversion strategy
exports.handler = async (event, context) => {
  try {
    // Define the watchlist with symbols to trade
    const watchlist = ['SBIN'];
    
    // Generate a session using the KiteConnect API
    const session = await kite.generateSession("request_token", "api_secret");
    
    // Execute mean reversion strategy for each symbol in the watchlist
    await Promise.all(watchlist.map(async (symbol) => {
      // Get historical prices for the symbol
      const prices = await getHistoricalPrices(symbol);
      
      // Check if mean reversion is triggered
      if (isMeanReversionTriggered(prices)) {
        // Get current positions
        const position = await kite.getPositions();
        // Find the position for the symbol
        const sbinPosition = position.net.find(p => p.tradingsymbol === symbol);
        // Buy if no position or if the position quantity is less than or equal to zero
        if (!sbinPosition) {
          await buy(symbol);
        } else if (sbinPosition.quantity <= 0) {
          await buy(symbol);
        } else {
          // Sell if the position quantity is greater than zero
          await sell(symbol);
        }
      }
    }));
    
    // Log successful execution
    console.log("Successfully executed.");
  } catch (err) {
    // Log any error encountered
    console.log(err);
  }
};
