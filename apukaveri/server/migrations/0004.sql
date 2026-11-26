CREATE TABLE avatars(user INTEGER PRIMARY KEY REFERENCES accounts ON DELETE CASCADE,pixels TEXT NOT NULL CHECK(length(pixels)=12288));
CREATE TABLE invoices(order_id INTEGER PRIMARY KEY REFERENCES orders,issued INTEGER NOT NULL DEFAULT(unixepoch()),cents INTEGER NOT NULL);
CREATE TRIGGER issue_invoice AFTER INSERT ON ledger WHEN NEW.kind='cash_due' AND NEW.cents>0 BEGIN INSERT INTO invoices(order_id,cents) VALUES(NEW.order_id,NEW.cents); END;
INSERT INTO invoices(order_id,cents) SELECT order_id,cents FROM ledger WHERE kind='cash_due' AND cents>0;
CREATE TABLE activity(user INTEGER PRIMARY KEY REFERENCES accounts ON DELETE CASCADE,last_seen INTEGER NOT NULL);
CREATE TABLE offers(id INTEGER PRIMARY KEY,order_id INTEGER REFERENCES orders,helper INTEGER REFERENCES accounts,created INTEGER NOT NULL DEFAULT(unixepoch()),seen INTEGER,UNIQUE(order_id,helper));
CREATE TRIGGER new_offer AFTER INSERT ON offers BEGIN INSERT INTO events(actor,order_id,kind,detail) VALUES(NEW.helper,NEW.order_id,'offer_created',CAST(NEW.id AS TEXT)); END;
CREATE TRIGGER read_offer AFTER UPDATE OF seen ON offers WHEN OLD.seen IS NULL AND NEW.seen IS NOT NULL BEGIN INSERT INTO events(actor,order_id,kind,detail) VALUES(NEW.helper,NEW.order_id,'offer_viewed',CAST(NEW.id AS TEXT)); END;
