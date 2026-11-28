ALTER TABLE accounts ADD COLUMN pilot_role TEXT CHECK(pilot_role IN ('customer','helper'));
