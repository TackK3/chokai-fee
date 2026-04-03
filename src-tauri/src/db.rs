use rusqlite::{Connection, Result, params};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Serialize, Deserialize)]
pub struct ExportData {
    pub version: u32,
    pub exported_at: String,
    pub years: Vec<Year>,
    pub districts: Vec<District>,
    pub members: Vec<Member>,
    pub payments: Vec<Payment>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Year {
    pub id: String,
    pub name: String, // e.g. "令和6年度"
    pub director: String, // 総務部長
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct District {
    pub id: String,
    pub year_id: String,
    pub department: i32, // 部 number
    pub district: i32,   // 地区 number
    pub representative: String, // 総代
    pub phone: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Member {
    pub id: String,
    pub district_id: String,
    pub address: String,  // 番地
    pub name: String,     // 氏名
    pub monthly_fee: i32, // 月額
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Payment {
    pub id: String,
    pub member_id: String,
    pub month: i32,  // 4-15 (4=April ... 15=March next year)
    pub amount: i32,
    pub paid: bool,
}

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn new() -> Result<Self> {
        let db_path = Self::db_path();
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let conn = Connection::open(&db_path)?;
        let db = Database {
            conn: Mutex::new(conn),
        };
        db.init_tables()?;
        Ok(db)
    }

    fn db_path() -> PathBuf {
        let mut path = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("."));
        path.push("chokai-fee");
        path.push("chokai-fee.db");
        path
    }

    fn init_tables(&self) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute_batch("
            CREATE TABLE IF NOT EXISTS years (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                director TEXT NOT NULL DEFAULT ''
            );

            CREATE TABLE IF NOT EXISTS districts (
                id TEXT PRIMARY KEY,
                year_id TEXT NOT NULL,
                department INTEGER NOT NULL,
                district INTEGER NOT NULL,
                representative TEXT NOT NULL DEFAULT '',
                phone TEXT NOT NULL DEFAULT '',
                FOREIGN KEY (year_id) REFERENCES years(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS members (
                id TEXT PRIMARY KEY,
                district_id TEXT NOT NULL,
                address TEXT NOT NULL DEFAULT '',
                name TEXT NOT NULL DEFAULT '',
                monthly_fee INTEGER NOT NULL DEFAULT 0,
                sort_order INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS payments (
                id TEXT PRIMARY KEY,
                member_id TEXT NOT NULL,
                month INTEGER NOT NULL,
                amount INTEGER NOT NULL DEFAULT 0,
                paid INTEGER NOT NULL DEFAULT 0,
                FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
                UNIQUE(member_id, month)
            );
        ")?;
        Ok(())
    }

    // === Years ===
    pub fn get_years(&self) -> Result<Vec<Year>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, director FROM years ORDER BY name DESC")?;
        let rows = stmt.query_map([], |row| {
            Ok(Year {
                id: row.get(0)?,
                name: row.get(1)?,
                director: row.get(2)?,
            })
        })?;
        rows.collect()
    }

    pub fn create_year(&self, name: &str, director: &str) -> Result<Year> {
        let id = uuid::Uuid::new_v4().to_string();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO years (id, name, director) VALUES (?1, ?2, ?3)",
            params![id, name, director],
        )?;
        Ok(Year {
            id,
            name: name.to_string(),
            director: director.to_string(),
        })
    }

    pub fn update_year(&self, id: &str, name: &str, director: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE years SET name = ?2, director = ?3 WHERE id = ?1",
            params![id, name, director],
        )?;
        Ok(())
    }

    pub fn delete_year(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM payments WHERE member_id IN (SELECT m.id FROM members m JOIN districts d ON m.district_id = d.id WHERE d.year_id = ?1)", params![id])?;
        conn.execute("DELETE FROM members WHERE district_id IN (SELECT id FROM districts WHERE year_id = ?1)", params![id])?;
        conn.execute("DELETE FROM districts WHERE year_id = ?1", params![id])?;
        conn.execute("DELETE FROM years WHERE id = ?1", params![id])?;
        Ok(())
    }

    // === Districts ===
    pub fn get_districts(&self, year_id: &str) -> Result<Vec<District>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, year_id, department, district, representative, phone FROM districts WHERE year_id = ?1 ORDER BY department, district"
        )?;
        let rows = stmt.query_map(params![year_id], |row| {
            Ok(District {
                id: row.get(0)?,
                year_id: row.get(1)?,
                department: row.get(2)?,
                district: row.get(3)?,
                representative: row.get(4)?,
                phone: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    pub fn create_district(&self, year_id: &str, department: i32, district: i32, representative: &str, phone: &str) -> Result<District> {
        let id = uuid::Uuid::new_v4().to_string();
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO districts (id, year_id, department, district, representative, phone) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, year_id, department, district, representative, phone],
        )?;
        Ok(District {
            id,
            year_id: year_id.to_string(),
            department,
            district,
            representative: representative.to_string(),
            phone: phone.to_string(),
        })
    }

    pub fn update_district(&self, id: &str, department: i32, district: i32, representative: &str, phone: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE districts SET department = ?2, district = ?3, representative = ?4, phone = ?5 WHERE id = ?1",
            params![id, department, district, representative, phone],
        )?;
        Ok(())
    }

    pub fn delete_district(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM payments WHERE member_id IN (SELECT id FROM members WHERE district_id = ?1)", params![id])?;
        conn.execute("DELETE FROM members WHERE district_id = ?1", params![id])?;
        conn.execute("DELETE FROM districts WHERE id = ?1", params![id])?;
        Ok(())
    }

    // === Members ===
    pub fn get_members(&self, district_id: &str) -> Result<Vec<Member>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, district_id, address, name, monthly_fee, sort_order FROM members WHERE district_id = ?1 ORDER BY sort_order"
        )?;
        let rows = stmt.query_map(params![district_id], |row| {
            Ok(Member {
                id: row.get(0)?,
                district_id: row.get(1)?,
                address: row.get(2)?,
                name: row.get(3)?,
                monthly_fee: row.get(4)?,
                sort_order: row.get(5)?,
            })
        })?;
        rows.collect()
    }

    pub fn create_member(&self, district_id: &str, address: &str, name: &str, monthly_fee: i32) -> Result<Member> {
        let id = uuid::Uuid::new_v4().to_string();
        let conn = self.conn.lock().unwrap();
        let sort_order: i32 = conn.query_row(
            "SELECT COALESCE(MAX(sort_order), 0) + 1 FROM members WHERE district_id = ?1",
            params![district_id],
            |row| row.get(0),
        )?;
        conn.execute(
            "INSERT INTO members (id, district_id, address, name, monthly_fee, sort_order) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, district_id, address, name, monthly_fee, sort_order],
        )?;
        Ok(Member {
            id,
            district_id: district_id.to_string(),
            address: address.to_string(),
            name: name.to_string(),
            monthly_fee,
            sort_order,
        })
    }

    pub fn update_member(&self, id: &str, address: &str, name: &str, monthly_fee: i32) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE members SET address = ?2, name = ?3, monthly_fee = ?4 WHERE id = ?1",
            params![id, address, name, monthly_fee],
        )?;
        Ok(())
    }

    pub fn delete_member(&self, id: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute("DELETE FROM payments WHERE member_id = ?1", params![id])?;
        conn.execute("DELETE FROM members WHERE id = ?1", params![id])?;
        Ok(())
    }

    // === Payments ===
    pub fn get_payments(&self, member_id: &str) -> Result<Vec<Payment>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, member_id, month, amount, paid FROM payments WHERE member_id = ?1 ORDER BY month"
        )?;
        let rows = stmt.query_map(params![member_id], |row| {
            Ok(Payment {
                id: row.get(0)?,
                member_id: row.get(1)?,
                month: row.get(2)?,
                amount: row.get(3)?,
                paid: row.get::<_, i32>(4)? != 0,
            })
        })?;
        rows.collect()
    }

    pub fn get_payments_for_district(&self, district_id: &str) -> Result<Vec<Payment>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT p.id, p.member_id, p.month, p.amount, p.paid FROM payments p JOIN members m ON p.member_id = m.id WHERE m.district_id = ?1 ORDER BY m.sort_order, p.month"
        )?;
        let rows = stmt.query_map(params![district_id], |row| {
            Ok(Payment {
                id: row.get(0)?,
                member_id: row.get(1)?,
                month: row.get(2)?,
                amount: row.get(3)?,
                paid: row.get::<_, i32>(4)? != 0,
            })
        })?;
        rows.collect()
    }

    pub fn upsert_payment(&self, member_id: &str, month: i32, amount: i32, paid: bool) -> Result<Payment> {
        let conn = self.conn.lock().unwrap();
        let existing: Option<String> = conn.query_row(
            "SELECT id FROM payments WHERE member_id = ?1 AND month = ?2",
            params![member_id, month],
            |row| row.get(0),
        ).ok();

        let id = existing.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
        conn.execute(
            "INSERT OR REPLACE INTO payments (id, member_id, month, amount, paid) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![id, member_id, month, amount, paid as i32],
        )?;
        Ok(Payment {
            id,
            member_id: member_id.to_string(),
            month,
            amount,
            paid,
        })
    }

    // === Export / Import ===
    pub fn export_all(&self) -> Result<ExportData> {
        let conn = self.conn.lock().unwrap();

        let mut stmt = conn.prepare("SELECT id, name, director FROM years ORDER BY name DESC")?;
        let years: Vec<Year> = stmt.query_map([], |row| {
            Ok(Year { id: row.get(0)?, name: row.get(1)?, director: row.get(2)? })
        })?.collect::<Result<Vec<_>>>()?;
        drop(stmt);

        let mut stmt = conn.prepare("SELECT id, year_id, department, district, representative, phone FROM districts")?;
        let districts: Vec<District> = stmt.query_map([], |row| {
            Ok(District {
                id: row.get(0)?, year_id: row.get(1)?, department: row.get(2)?,
                district: row.get(3)?, representative: row.get(4)?, phone: row.get(5)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        drop(stmt);

        let mut stmt = conn.prepare("SELECT id, district_id, address, name, monthly_fee, sort_order FROM members")?;
        let members: Vec<Member> = stmt.query_map([], |row| {
            Ok(Member {
                id: row.get(0)?, district_id: row.get(1)?, address: row.get(2)?,
                name: row.get(3)?, monthly_fee: row.get(4)?, sort_order: row.get(5)?,
            })
        })?.collect::<Result<Vec<_>>>()?;
        drop(stmt);

        let mut stmt = conn.prepare("SELECT id, member_id, month, amount, paid FROM payments")?;
        let payments: Vec<Payment> = stmt.query_map([], |row| {
            Ok(Payment {
                id: row.get(0)?, member_id: row.get(1)?, month: row.get(2)?,
                amount: row.get(3)?, paid: row.get::<_, i32>(4)? != 0,
            })
        })?.collect::<Result<Vec<_>>>()?;
        drop(stmt);

        let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();

        Ok(ExportData {
            version: 1,
            exported_at: now,
            years,
            districts,
            members,
            payments,
        })
    }

    pub fn import_all(&self, data: &ExportData) -> Result<()> {
        let conn = self.conn.lock().unwrap();

        conn.execute_batch("
            DELETE FROM payments;
            DELETE FROM members;
            DELETE FROM districts;
            DELETE FROM years;
        ")?;

        for y in &data.years {
            conn.execute(
                "INSERT INTO years (id, name, director) VALUES (?1, ?2, ?3)",
                params![y.id, y.name, y.director],
            )?;
        }
        for d in &data.districts {
            conn.execute(
                "INSERT INTO districts (id, year_id, department, district, representative, phone) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![d.id, d.year_id, d.department, d.district, d.representative, d.phone],
            )?;
        }
        for m in &data.members {
            conn.execute(
                "INSERT INTO members (id, district_id, address, name, monthly_fee, sort_order) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![m.id, m.district_id, m.address, m.name, m.monthly_fee, m.sort_order],
            )?;
        }
        for p in &data.payments {
            conn.execute(
                "INSERT INTO payments (id, member_id, month, amount, paid) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![p.id, p.member_id, p.month, p.amount, p.paid as i32],
            )?;
        }

        Ok(())
    }
}
