CREATE TABLE test_card_payments (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id),
  cents INTEGER NOT NULL CHECK(cents>0),
  expires INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK(status IN ('reserved','captured','released'))
);

CREATE TRIGGER test_card_capture AFTER INSERT ON confirmations
WHEN NEW.topic='completion' AND NEW.answer='yes'
BEGIN
  UPDATE test_card_payments SET status='captured'
    WHERE order_id=NEW.order_id AND status='reserved'
      AND NEW.actor=(SELECT customer FROM orders WHERE id=NEW.order_id)
      AND EXISTS(SELECT 1 FROM confirmations c JOIN orders o ON o.id=c.order_id
        WHERE c.order_id=NEW.order_id AND c.actor=o.provider AND c.topic='completion' AND c.answer='yes')
      AND NOT EXISTS(SELECT 1 FROM confirmations WHERE order_id=NEW.order_id AND answer='dispute');
END;

CREATE TRIGGER test_card_earning AFTER UPDATE OF status ON test_card_payments
WHEN OLD.status='reserved' AND NEW.status='captured'
BEGIN
  INSERT INTO test_wallet_entries(account,order_id,kind,cents,ref)
    SELECT provider,id,'earning',labour+reimbursement,'earning-'||id FROM orders WHERE id=NEW.order_id;
  INSERT INTO events(actor,order_id,kind)
    SELECT provider,id,'test_earning_available' FROM orders WHERE id=NEW.order_id;
END;

CREATE TRIGGER test_card_cancel AFTER UPDATE OF cancelled ON orders
WHEN OLD.cancelled=0 AND NEW.cancelled<>0
BEGIN
  UPDATE test_card_payments SET status='released' WHERE order_id=NEW.id AND status='reserved';
END;
