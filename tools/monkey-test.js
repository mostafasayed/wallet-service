import fetch from "node-fetch";
import { randomUUID } from "crypto";

const API_URL = process.env.API_URL || "http://localhost:3000";

const OPERATIONS = ["deposit", "withdraw", "transfer"];
const WALLET_POOL = 20;
const REQUESTS = 1000; 
const CONCURRENCY = 100;

function randomWallet() {
  return `wallet-${Math.floor(Math.random() * WALLET_POOL) + 1}`;
}

function randomAmount() {
  return Number((Math.random() * 10 + 1).toFixed(2)); // 1 to 10 units
}

async function doDeposit() {
  const walletId = randomWallet();
  const body = {
    amount: randomAmount(),
    requestId: randomUUID(),
  };

  const res = await fetch(`${API_URL}/wallet/${walletId}/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    op: "deposit",
    walletId,
    status: res.status,
  };
}

async function doWithdraw() {
  const walletId = randomWallet();
  const body = {
    amount: randomAmount(),
    requestId: randomUUID(),
  };

  const res = await fetch(`${API_URL}/wallet/${walletId}/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    op: "withdraw",
    walletId,
    status: res.status,
  };
}

async function doTransfer() {
  const from = randomWallet();
  let to = randomWallet();
  if (from === to) to = randomWallet();

  const body = {
    toWalletId: to,
    amount: randomAmount(),
    requestId: randomUUID(),
  };

  const res = await fetch(`${API_URL}/wallet/${from}/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  return {
    op: "transfer",
    from,
    to,
    status: res.status,
  };
}

async function performRandomOp() {
  const op = OPERATIONS[Math.floor(Math.random() * OPERATIONS.length)];
  if (op === "deposit") return doDeposit();
  if (op === "withdraw") return doWithdraw();
  return doTransfer();
}

async function startMonkeyTest() {
  console.log(`🐒 Starting Monkey Test`);
  console.log(`Sending ${REQUESTS} requests with concurrency ${CONCURRENCY}`);
  console.log(`API URL = ${API_URL}`);

  let completed = 0;
  let errors = 0;

  const batches = Math.ceil(REQUESTS / CONCURRENCY);

  for (let i = 0; i < batches; i++) {
    console.log(`Batch ${i + 1}/${batches}`);

    const promises = [];
    for (let j = 0; j < CONCURRENCY; j++) {
      promises.push(
        performRandomOp().catch((err) => {
            console.log(err)
          errors++;
          return { error: true, err };
        })
      );
    }

    const results = await Promise.all(promises);

    for (const r of results) {
      completed++;
      if (r.status >= 500) errors++;
    }
  }

  console.log(`\n--- Monkey Test Results ---`);
  console.log(`Completed: ${completed}`);
  console.log(`Errors: ${errors}`);
  console.log(`---------------------------\n`);
}

startMonkeyTest();
