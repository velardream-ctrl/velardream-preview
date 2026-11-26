ALTER TABLE orders ADD COLUMN cancelled INTEGER NOT NULL DEFAULT 0;
DROP TRIGGER reserve;
CREATE TRIGGER reserve BEFORE UPDATE OF provider ON orders WHEN NEW.cancelled=0 AND NEW.provider IS NOT NULL AND EXISTS(SELECT 1 FROM orders WHERE cancelled=0 AND provider=NEW.provider AND id<>NEW.id AND start<NEW.end AND end>NEW.start) BEGIN SELECT RAISE(ABORT,'occupied'); END;
CREATE UNIQUE INDEX one_cancellation ON events(order_id) WHERE kind='cancelled';
CREATE TRIGGER cancellation AFTER UPDATE OF cancelled ON orders WHEN OLD.cancelled=0 AND NEW.cancelled<>0 BEGIN INSERT INTO events(actor,order_id,kind) VALUES(NEW.cancelled,NEW.id,'cancelled'); END;
