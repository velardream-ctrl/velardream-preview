CREATE TABLE test_wallet_entries (
  id INTEGER PRIMARY KEY,
  account INTEGER NOT NULL REFERENCES accounts(id),
  order_id INTEGER REFERENCES orders(id),
  kind TEXT NOT NULL CHECK(kind IN ('topup','payment','earning','refund','withdrawal')),
  cents INTEGER NOT NULL CHECK(cents<>0),
  ref TEXT NOT NULL UNIQUE,
  created INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX test_wallet_by_account ON test_wallet_entries(account,id);

CREATE TRIGGER test_wallet_no_overdraft BEFORE INSERT ON test_wallet_entries
WHEN NEW.cents<0 AND NEW.cents + COALESCE((SELECT sum(cents) FROM test_wallet_entries WHERE account=NEW.account),0)<0
BEGIN
  SELECT RAISE(ABORT,'test_wallet_insufficient');
END;

CREATE TRIGGER test_wallet_release AFTER INSERT ON confirmations
WHEN NEW.topic='completion' AND NEW.answer='yes'
BEGIN
  INSERT OR IGNORE INTO test_wallet_entries(account,order_id,kind,cents,ref)
    SELECT o.provider,o.id,'earning',o.labour+o.reimbursement-o.fee,'earning-'||o.id
    FROM orders o
    WHERE o.id=NEW.order_id AND o.cancelled=0 AND o.provider IS NOT NULL
      AND o.labour+o.reimbursement>o.fee
      AND EXISTS(SELECT 1 FROM test_wallet_entries WHERE ref='payment-'||o.id)
      AND (SELECT count(*) FROM confirmations WHERE order_id=o.id AND topic='completion' AND answer='yes')=2
      AND NOT EXISTS(SELECT 1 FROM confirmations WHERE order_id=o.id AND answer='dispute');
END;

CREATE TRIGGER test_wallet_return AFTER UPDATE OF cancelled ON orders
WHEN OLD.cancelled=0 AND NEW.cancelled<>0
BEGIN
  INSERT OR IGNORE INTO test_wallet_entries(account,order_id,kind,cents,ref)
    SELECT NEW.customer,NEW.id,'refund',-cents,'refund-'||NEW.id
    FROM test_wallet_entries WHERE ref='payment-'||NEW.id;
END;
