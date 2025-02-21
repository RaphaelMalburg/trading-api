# Trading System Rules and Logic

## Overview

The trading system uses AI-powered technical analysis to identify and manage trading opportunities across multiple instruments. The system integrates with GPT-4 Vision for chart analysis and follows strict risk management rules.

## AI Analysis Response Format

The AI model must return a JSON response with the following structure:

```json
{
  "action": "buy" | "sell" | "stay_out",
  "confidence_score": 0-100,
  "risk_percentage": 0.5-2.0,
  "entry": {
    "price": number,
    "type": "market" | "limit"
  },
  "stop_loss": {
    "price": number,
    "technical_reason": string
  },
  "take_profit": {
    "price": number,
    "risk_multiple": 1-4
  },
  "position_management": {
    "should_modify": boolean,
    "new_stop_loss": number | null,
    "should_close": boolean,
    "close_reason": string | null
  }
}
```

## Trading Rules

### Entry Conditions

1. Maximum of 3 open positions at any time
2. New trades only allowed when:
   - Account has less than 3 open positions
   - Confidence score > 75 for new entries
   - Clear technical stop loss level identified
   - Risk-reward ratio ≥ 1:1
3. Confidence Score Requirements:
   - New positions: Minimum 75/100
   - Adding to positions: Minimum 85/100
   - Counter-trend trades: Minimum 90/100
   - Mean reversion trades: Minimum 80/100

### Risk Management

1. Position Size Calculation:
   ```
   Risk Amount = Account Balance × Risk Percentage (0.5% to 2%) of the account balance
   Position Size = Risk Amount ÷ (Entry Price - Stop Loss Price)
   ```
2. Risk Percentage Limits:
   - Minimum: 0.5% per trade
   - Maximum: 2% per trade
   - Total risk across all positions: Maximum 6%

### Stop Loss Rules

1. Stop loss must be based on technical levels:
   - Below key support (for longs)
   - Above key resistance (for shorts)
   - Below recent swing low (for longs)
   - Above recent swing high (for shorts)
2. Stop loss modification:
   - Only allowed in favor of the trade
   - Must maintain or improve risk-reward ratio
   - Must have technical justification

### Take Profit Rules

1. Minimum target: 1× risk amount
2. Maximum target: 4× risk amount
3. Multiple take profit levels allowed if:
   - First target ≥ 1× risk
   - Total weighted average ≥ 1× risk

### Position Management

1. Open Position Monitoring:
   - AI analyzes each open position
   - Can recommend:
     - Stop loss adjustment (only in profit direction)
     - Position closure
     - Partial profit taking
   - Confidence score requirements for modifications:
     - Stop loss adjustment: Minimum 70/100
     - Position closure: Minimum 80/100
     - Adding to position: Minimum 85/100
2. Maximum Positions:
   - Hard limit of 3 open positions
   - System tracks:
     - Current price
     - Unrealized P/L
     - Distance to stop loss/take profit
     - Risk-reward ratio
3. Position Modification Rules:
   - Stop loss adjustments require:
     - Minimum confidence score of 70
     - Clear technical justification
     - Must be in profit direction only
   - Position closure requires:
     - Confidence score above 80 for early exit
     - Technical violation of entry premise
     - Risk-reward deterioration below 1:1

### Trading Strategies

#### 1. EMA Pullback Strategy

Entry Conditions:

- Price pulls back to EMA (20, 50, or 200)
- RSI shows momentum reversal
- Higher timeframe trend aligned
- Clear technical stop loss level

Exit Conditions:

- Take profit at predefined risk multiple
- Stop loss at technical level below pullback low
- Trailing stop after 1.5× risk achieved

#### 2. Mean Reversion Strategy

Entry Conditions:

- Price at Bollinger Band extremes
- RSI oversold/overbought
- Volume confirmation
- Clear technical stop level

Exit Conditions:

- Take profit at mean (middle Bollinger Band)
- Stop loss beyond recent swing high/low
- Scale out at predefined levels

## AI Analysis Process

1. Chart Analysis:

   - Identify trend direction and strength
   - Locate key support/resistance levels
   - Detect technical patterns
   - Calculate momentum indicators

2. Trade Decision:

   - Evaluate entry conditions
   - Calculate optimal position size
   - Determine stop loss and take profit levels
   - Assign confidence score

3. Position Management:
   - Monitor open positions
   - Evaluate stop loss adjustments
   - Recommend position closure if conditions change
   - Track risk-reward evolution

## System Integration

1. Account Information:

   - Balance
   - Open positions
   - Current risk exposure
   - Available margin

2. Position Tracking:

   - Entry price and size
   - Current P/L
   - Risk-reward ratio
   - Time in trade

3. Risk Monitoring:
   - Per-position risk
   - Total portfolio risk
   - Distance to stop loss/take profit
   - Risk-reward ratio changes

## Example AI Analysis Input

```json
{
  "account": {
    "balance": 100000,
    "open_positions": [
      {
        "symbol": "AAPL",
        "entry_price": 150,
        "current_price": 155,
        "stop_loss": 148,
        "take_profit": 160,
        "size": 100,
        "unrealized_pl": 500
      }
    ],
    "available_positions": 2
  },
  "chart_data": {
    "symbol": "MSFT",
    "timeframe": "4H",
    "technical_indicators": {
      "ema": [20, 50, 200],
      "rsi": 14,
      "bollinger_bands": [20, 2]
    }
  }
}
```

## Example AI Analysis Output

```json
{
  "action": "buy",
  "confidence_score": 85,
  "risk_percentage": 1.0,
  "entry": {
    "price": 280.5,
    "type": "limit"
  },
  "stop_loss": {
    "price": 278.3,
    "technical_reason": "Below recent swing low and 20 EMA"
  },
  "take_profit": {
    "price": 284.9,
    "risk_multiple": 2
  },
  "position_management": {
    "should_modify": false,
    "new_stop_loss": null,
    "should_close": false,
    "close_reason": null
  }
}
```
