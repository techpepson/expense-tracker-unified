"""Create the first admin account, demo employee accounts, starter categories, and items.

Run once after the migrations:   python -m app.seed
Safe to run again: it only adds what is missing.
"""

import json
from pathlib import Path
from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.security import hash_password
from app.database import SessionLocal
from app.models import ExpenseCategory, ExpenseItem, ItemStatus, User, UserRole
from app.routers.admin import apply_admin_import

DEFAULT_CATEGORIES = [
    "Office Supplies",
    "Kitchen Supplies",
    "Cleaning & Hygiene Supplies",
    "Electricity",
    "Water",
    "Internet and telecommunications",
    "Rent",
    "Fuel",
    "Transportation",
    "Stationery and office supplies",
    "Maintenance and repairs",
    "Cleaning",
    "Other",
]

STARTER_ITEMS_BY_CATEGORY: dict[str, list[str]] = {
    "Office Supplies": [
        "A4 Sheet",
        "Printer Ink",
        "Official Stamp",
        "Stapler",
        "Staple Pins",
        "Socket extension",
        "Brown Envelops",
        "Bottled Water",
        "Sticky Notes",
        "Paper clip",
        "Disposable cups",
        "Storage Basket",
        "Water for Dispenser",
        "Tableware set",
        "Bag of Water",
        "Internet",
        "Airtime",
        "Electricity",
        "Water Bill",
    ],
    "Kitchen Supplies": [
        "Disposable Spoon",
        "Disposable plates",
        "Coffee",
        "Cleaning Cloth",
        "USB Drive",
        "Teabag",
        "Sugar",
        "Honey",
        "Cracker Biscuit",
        "Milk",
        "Cappuccino",
        "Sweetner",
        "Snacks for Visitors",
    ],
    "Cleaning & Hygiene Supplies": [
        "Garbage bags",
        "Gloves",
        "Hand sanitizer",
        "Jumbo tissue",
        "Dishwashing Liquidsoap",
        "Insecticide spray",
        "Handwash Liquidsoap",
        "Toilet roll",
        "Glass Cleaner",
        "Bleach",
        "Air Freshner",
        "WC Power Balls",
        "Naphthalene Balls",
        "Floor cleaner",
        "Water Barrel",
        "Funnel",
        "Washing Powder",
        "Anticeptic",
        "Mop",
        "Sponge",
    ],
    "Electricity": ["Prepaid Electricity Credit", "Monthly Electricity Bill", "Generator Power"],
    "Water": ["GWCL Water Bill", "Dispenser Water Bottle", "Sachet Water Bag", "Water Tanker Delivery"],
    "Internet and telecommunications": ["Fiber Broadband Subscription", "Mobile Data Bundle", "Office Airtime"],
    "Rent": ["Monthly Office Rent", "Service Charge"],
    "Fuel": ["Petrol", "Diesel", "Generator Fuel"],
    "Transportation": ["Ride Hail / Taxi", "Courier & Delivery", "Bus / Trotro Fare"],
    "Stationery and office supplies": ["A4 Paper Ream", "Printer Toner", "Pens & Markers", "Envelopes", "Stapler & Pins"],
    "Maintenance and repairs": ["AC Servicing", "Plumbing Repair", "Electrical Repair", "Door Lock Replacement"],
    "Cleaning": ["Disinfectant", "Trash Bags", "Liquid Soap", "Paper Towels"],
    "Other": [
        "Transport",
        "Delivery",
        "Plumber",
        "Waste collector",
        "Office Phone Battery",
        "Water transport",
        "Service charge",
        "Light Rental",
        "First Aid",
        "Key cutting",
        "Domain Renewal",
        "Door Lock",
        "Toner",
        "Operational expense",
        "Fuel",
        "Deposit / Withdrawal Charge",
        "Gallon",
        "Business Card",
        "Welding Service",
        "AC Servicing",
        "PPA Renewal",
        "AMA Bill",
        "Cellotape",
        "Macbook Charger Cord",
        "Phone screen protector",
    ],
}

DEMO_ADMINS = [
    ("Kwame Mensah", "admin@ecom.com", "password123"),
]

DEMO_EMPLOYEES = [
    ("John Doe", "employee@ecom.com", "password123", True),
    ("Jane Smith", "jane@ecom.com", "password123", False),
    ("Akua Boateng", "akua@ecom.com", "password123", True),
    ("Kojo Asante", "kojo@ecom.com", "password123", False),
]


def run() -> None:
    settings = get_settings()
    with SessionLocal() as db:
        email = settings.first_admin_email.lower()
        if db.scalar(select(User.id).where(User.email == email)) is None:
            db.add(
                User(
                    full_name=settings.first_admin_name,
                    email=email,
                    password_hash=hash_password(settings.first_admin_password),
                    role=UserRole.ADMIN,
                    can_record_shared=True,
                )
            )
            print(f"Created admin account: {email}")
        else:
            print(f"Admin account already exists: {email}")

        for full_name, adm_email, adm_password in DEMO_ADMINS:
            if db.scalar(select(User.id).where(User.email == adm_email)) is None:
                db.add(
                    User(
                        full_name=full_name,
                        email=adm_email,
                        password_hash=hash_password(adm_password),
                        role=UserRole.ADMIN,
                        can_record_shared=True,
                    )
                )
                print(f"Created admin account: {adm_email}")

        for full_name, emp_email, emp_password, can_shared in DEMO_EMPLOYEES:
            if db.scalar(select(User.id).where(User.email == emp_email)) is None:
                db.add(
                    User(
                        full_name=full_name,
                        email=emp_email,
                        password_hash=hash_password(emp_password),
                        role=UserRole.EMPLOYEE,
                        can_record_shared=can_shared,
                    )
                )
                print(f"Created employee account: {emp_email}")

        existing_cats = {
            c.name.lower(): c for c in db.scalars(select(ExpenseCategory)).all()
        }
        added_cats = 0
        for idx, name in enumerate(DEFAULT_CATEGORIES, start=1):
            if name.lower() not in existing_cats:
                cat = ExpenseCategory(name=name, sort_order=idx)
                db.add(cat)
                db.flush()
                existing_cats[name.lower()] = cat
                added_cats += 1
            elif not existing_cats[name.lower()].sort_order:
                existing_cats[name.lower()].sort_order = idx
        db.commit()
        print(f"Added {added_cats} categories")

        added_items = 0
        for cat_name, item_names in STARTER_ITEMS_BY_CATEGORY.items():
            cat = existing_cats.get(cat_name.lower())
            if cat is None:
                continue
            existing_item_names = {
                n.lower()
                for n in db.scalars(
                    select(ExpenseItem.name).where(ExpenseItem.category_id == cat.id)
                ).all()
            }
            for item_name in item_names:
                if item_name.lower() not in existing_item_names:
                    db.add(
                        ExpenseItem(
                            category_id=cat.id,
                            name=item_name,
                            status=ItemStatus.APPROVED,
                        )
                    )
                    existing_item_names.add(item_name.lower())
                    added_items += 1
        db.commit()
        print(f"Added {added_items} starter items")

        seed_dir = (
            Path(__file__).resolve().parents[3]
            / "expense-tracker-admin"
            / "src"
            / "mocks"
            / "seed"
        )
        if seed_dir.exists():
            admin_user = db.scalar(
                select(User).where(User.role == UserRole.ADMIN).order_by(User.id.asc())
            )
            if admin_user is not None:
                cats_json = json.loads((seed_dir / "categories.json").read_text(encoding="utf-8"))
                items_json = json.loads((seed_dir / "items.json").read_text(encoding="utf-8"))
                expenses_json = json.loads((seed_dir / "expenses.json").read_text(encoding="utf-8"))
                pc_json = json.loads((seed_dir / "petty-cash.json").read_text(encoding="utf-8"))
                ob_json = json.loads((seed_dir / "opening-balance.json").read_text(encoding="utf-8"))

                cat_name_by_seed_id = {c["id"]: c["name"] for c in cats_json}
                payload = {
                    "categories": [
                        {"name": c["name"], "sort_order": c.get("sort_order", i + 1)}
                        for i, c in enumerate(cats_json)
                    ],
                    "items": [
                        {
                            "key": it["id"],
                            "category": cat_name_by_seed_id.get(it["category_id"], "Other"),
                            "name": it["name"],
                        }
                        for it in items_json
                    ],
                    "expenses": [
                        {
                            "import_key": e["import_key"],
                            "category": cat_name_by_seed_id.get(e["category_id"], "Other"),
                            "item_key": e["item_id"],
                            "unit_cost": e["unit_cost"],
                            "quantity": e["quantity"],
                            "description": e.get("description", ""),
                            "expense_date": e["expense_date"],
                        }
                        for e in expenses_json
                    ],
                    "petty_cash": [
                        {
                            "import_key": p["import_key"],
                            "entry_type": p["entry_type"],
                            "amount": p["amount"],
                            "entry_date": p["entry_date"],
                            "description": p["description"],
                        }
                        for p in pc_json
                    ],
                    "opening_balance": ob_json,
                }
                counts = apply_admin_import(payload, db, admin_user)
                print(f"Spreadsheet seed import: {counts}")


if __name__ == "__main__":
    run()
