#!/usr/bin/env python3
"""Builds src/lib/food-data.json from the USDA National Nutrient Database for
Standard Reference, Release 28 (public domain, US Department of Agriculture,
Agricultural Research Service).

Usage:
  npm pack fda-nutrient-database   # contains data/ABBREV.txt (SR28 abbreviated file)
  python3 scripts/build-food-data.py path/to/ABBREV.txt

All values are per 100 g of the edible part. Salt is sodium x 2.5 (EU labelling rule).
"""
import json
import sys
from pathlib import Path

# ABBREV.txt column positions (SR28 documentation, page 44).
COL = {
    'kcal': 3, 'protein': 4, 'fat': 5, 'carbs': 7, 'fiber': 8, 'sugar': 9,
    'calcium': 10, 'iron': 11, 'magnesium': 12, 'potassium': 14, 'sodium': 15, 'zinc': 16,
    'vitC': 20, 'vitB12': 31, 'vitD': 41, 'satFat': 44,
}

# key, NDB number, name, German and other search words, category, servings (label, grams)
FOODS = [
    # Fruit
    ('banana', '09040', 'Banana', 'Banane', 'Fruit', [('1 medium', 118)]),
    ('apple', '09003', 'Apple', 'Apfel', 'Fruit', [('1 medium', 182)]),
    ('orange', '09200', 'Orange', 'Orange Apfelsine', 'Fruit', [('1 medium', 140)]),
    ('pear', '09252', 'Pear', 'Birne', 'Fruit', [('1 medium', 178)]),
    ('kiwi', '09148', 'Kiwi', 'Kiwi', 'Fruit', [('1 kiwi', 69)]),
    ('grapes', '09132', 'Grapes', 'Weintrauben Trauben', 'Fruit', [('1 handful', 80)]),
    ('strawberries', '09316', 'Strawberries', 'Erdbeeren', 'Fruit', [('1 handful', 100)]),
    ('blueberries', '09050', 'Blueberries', 'Heidelbeeren Blaubeeren', 'Fruit', [('1 handful', 75)]),
    ('raspberries', '09302', 'Raspberries', 'Himbeeren', 'Fruit', [('1 handful', 75)]),
    ('pineapple', '09266', 'Pineapple', 'Ananas', 'Fruit', [('1 slice', 85)]),
    ('mango', '09176', 'Mango', 'Mango', 'Fruit', [('1/2 mango', 165)]),
    ('peach', '09236', 'Peach', 'Pfirsich', 'Fruit', [('1 medium', 150)]),
    ('watermelon', '09326', 'Watermelon', 'Wassermelone', 'Fruit', [('1 slice', 280)]),
    ('cherries', '09070', 'Cherries', 'Kirschen', 'Fruit', [('1 handful', 100)]),
    ('plum', '09279', 'Plum', 'Zwetschke Pflaume', 'Fruit', [('1 plum', 66)]),
    ('apricot', '09021', 'Apricot', 'Marille Aprikose', 'Fruit', [('1 apricot', 35)]),
    ('lemon', '09150', 'Lemon', 'Zitrone', 'Fruit', [('1 lemon', 58)]),
    ('avocado', '09037', 'Avocado', 'Avocado', 'Fruit', [('1/2 avocado', 75)]),
    ('dates', '09421', 'Dates (Medjool)', 'Datteln', 'Fruit', [('1 date', 24)]),
    ('raisins', '09298', 'Raisins', 'Rosinen', 'Fruit', [('1 tbsp', 10)]),
    # Vegetables
    ('broccoli', '11090', 'Broccoli', 'Brokkoli', 'Vegetables', [('1 portion', 150)]),
    ('spinach', '11457', 'Spinach', 'Spinat Blattspinat', 'Vegetables', [('1 handful', 30)]),
    ('tomato', '11529', 'Tomato', 'Tomate Paradeiser', 'Vegetables', [('1 medium', 123)]),
    ('cucumber', '11205', 'Cucumber', 'Gurke Salatgurke', 'Vegetables', [('1/2 cucumber', 150)]),
    ('bell-pepper', '11821', 'Red bell pepper', 'Paprika rot', 'Vegetables', [('1 pepper', 120)]),
    ('carrot', '11124', 'Carrot', 'Karotte Möhre', 'Vegetables', [('1 medium', 61)]),
    ('onion', '11282', 'Onion', 'Zwiebel', 'Vegetables', [('1 medium', 110)]),
    ('garlic', '11215', 'Garlic', 'Knoblauch', 'Vegetables', [('1 clove', 3)]),
    ('zucchini', '11477', 'Zucchini', 'Zucchini', 'Vegetables', [('1 medium', 200)]),
    ('mushrooms', '11260', 'Mushrooms', 'Champignons Pilze', 'Vegetables', [('1 portion', 100)]),
    ('lettuce', '11251', 'Romaine lettuce', 'Salat Römersalat Blattsalat', 'Vegetables', [('1 bowl', 50)]),
    ('cauliflower', '11135', 'Cauliflower', 'Karfiol Blumenkohl', 'Vegetables', [('1 portion', 150)]),
    ('green-beans', '11052', 'Green beans', 'Fisolen grüne Bohnen', 'Vegetables', [('1 portion', 125)]),
    ('asparagus', '11011', 'Asparagus', 'Spargel', 'Vegetables', [('1 portion', 150)]),
    ('cabbage', '11109', 'Cabbage', 'Kraut Weißkohl', 'Vegetables', [('1 portion', 100)]),
    ('kale', '11233', 'Kale', 'Grünkohl', 'Vegetables', [('1 handful', 30)]),
    ('celery', '11143', 'Celery', 'Stangensellerie', 'Vegetables', [('1 stalk', 40)]),
    ('peas', '11312', 'Green peas', 'Erbsen', 'Vegetables', [('1 portion', 80)]),
    ('corn', '11172', 'Sweet corn (canned)', 'Mais', 'Vegetables', [('1 portion', 80)]),
    ('potato', '11674', 'Potato (baked)', 'Kartoffel Erdapfel', 'Vegetables', [('1 medium', 173)]),
    ('potato-raw', '11352', 'Potato (raw)', 'Kartoffel Erdapfel roh', 'Vegetables', [('1 medium', 213)]),
    ('sweet-potato', '11508', 'Sweet potato (baked)', 'Süßkartoffel', 'Vegetables', [('1 medium', 114)]),
    ('tomatoes-canned', '11693', 'Crushed tomatoes (canned)', 'Tomaten Dose passiert Paradeiser', 'Vegetables', [('1/2 can', 200)]),
    ('olives', '09193', 'Olives', 'Oliven', 'Vegetables', [('5 olives', 20)]),
    ('edamame', '11212', 'Edamame', 'Edamame Sojabohnen', 'Vegetables', [('1 portion', 100)]),
    # Grains and bread
    ('oats', '08120', 'Rolled oats', 'Haferflocken Hafer', 'Grains', [('1 portion', 50)]),
    ('granola', '08037', 'Granola', 'Müsli Granola Knuspermüsli', 'Grains', [('1 portion', 50)]),
    ('rice', '20345', 'White rice (cooked)', 'Reis gekocht', 'Grains', [('1 portion', 180)]),
    ('rice-dry', '20044', 'White rice (dry)', 'Reis roh trocken', 'Grains', [('1 portion', 75)]),
    ('brown-rice', '20037', 'Brown rice (cooked)', 'Vollkornreis Naturreis', 'Grains', [('1 portion', 180)]),
    ('pasta', '20121', 'Pasta (cooked)', 'Nudeln Pasta Spaghetti gekocht', 'Grains', [('1 portion', 200)]),
    ('pasta-dry', '20120', 'Pasta (dry)', 'Nudeln Pasta Spaghetti roh trocken', 'Grains', [('1 portion', 100)]),
    ('pasta-wholewheat', '20125', 'Whole-wheat pasta (cooked)', 'Vollkornnudeln', 'Grains', [('1 portion', 200)]),
    ('noodles-rice', '20134', 'Rice noodles (cooked)', 'Reisnudeln', 'Grains', [('1 portion', 175)]),
    ('quinoa', '20137', 'Quinoa (cooked)', 'Quinoa', 'Grains', [('1 portion', 185)]),
    ('couscous', '20029', 'Couscous (cooked)', 'Couscous', 'Grains', [('1 portion', 160)]),
    ('bulgur', '20013', 'Bulgur (cooked)', 'Bulgur', 'Grains', [('1 portion', 180)]),
    ('bread-wholewheat', '18075', 'Whole-wheat bread', 'Vollkornbrot Brot', 'Grains', [('1 slice', 40)]),
    ('bread-white', '18069', 'White bread / toast', 'Weißbrot Toast Toastbrot', 'Grains', [('1 slice', 30)]),
    ('bread-rye', '18060', 'Rye bread', 'Roggenbrot Schwarzbrot Brot', 'Grains', [('1 slice', 45)]),
    ('bread-multigrain', '28397', 'Multigrain bread', 'Mehrkornbrot Körnerbrot', 'Grains', [('1 slice', 45)]),
    ('roll', '18350', 'Bread roll', 'Semmel Brötchen Weckerl', 'Grains', [('1 roll', 50)]),
    ('bagel', '18001', 'Bagel', 'Bagel', 'Grains', [('1 bagel', 98)]),
    ('pita', '18041', 'Pita bread', 'Pita Fladenbrot', 'Grains', [('1 pita', 60)]),
    ('tortilla', '18364', 'Flour tortilla / wrap', 'Tortilla Wrap', 'Grains', [('1 wrap', 60)]),
    ('croissant', '18239', 'Croissant', 'Croissant Kipferl', 'Grains', [('1 croissant', 57)]),
    ('rice-cakes', '19816', 'Rice cakes', 'Reiswaffeln', 'Grains', [('1 cake', 9)]),
    ('flour', '20081', 'Wheat flour', 'Mehl Weizenmehl', 'Grains', [('1 tbsp', 8)]),
    # Meat, fish, eggs
    ('chicken-breast', '05064', 'Chicken breast (cooked)', 'Hühnerbrust Hähnchenbrust Huhn gebraten', 'Meat & fish', [('1 portion', 150)]),
    ('chicken-breast-raw', '05062', 'Chicken breast (raw)', 'Hühnerbrust Hähnchenbrust Huhn roh', 'Meat & fish', [('1 fillet', 175)]),
    ('turkey-breast', '05710', 'Turkey breast (raw)', 'Putenbrust Truthahn Pute', 'Meat & fish', [('1 portion', 150)]),
    ('beef-mince', '23562', 'Lean beef mince (raw)', 'Faschiertes Rinderhack Hackfleisch', 'Meat & fish', [('1 portion', 125)]),
    ('beef-mince-cooked', '23565', 'Lean beef mince (cooked)', 'Faschiertes Rinderhack gebraten', 'Meat & fish', [('1 portion', 100)]),
    ('pork-tenderloin', '10060', 'Pork tenderloin (raw)', 'Schweinefilet Schwein', 'Meat & fish', [('1 portion', 150)]),
    ('ham', '07028', 'Ham (sliced)', 'Schinken Kochschinken', 'Meat & fish', [('1 slice', 20)]),
    ('frankfurter', '07022', 'Frankfurter sausage', 'Frankfurter Würstel Wurst', 'Meat & fish', [('1 pair', 90)]),
    ('salmon', '15237', 'Salmon (cooked)', 'Lachs gebraten', 'Meat & fish', [('1 fillet', 125)]),
    ('salmon-raw', '15236', 'Salmon (raw)', 'Lachs roh Lachsfilet', 'Meat & fish', [('1 fillet', 125)]),
    ('cod', '15015', 'Cod (raw)', 'Kabeljau Dorsch Fisch', 'Meat & fish', [('1 fillet', 150)]),
    ('tuna', '15121', 'Tuna in water (canned)', 'Thunfisch Dose', 'Meat & fish', [('1 can', 120)]),
    ('shrimp', '15149', 'Shrimp (raw)', 'Garnelen Shrimps Crevetten', 'Meat & fish', [('1 portion', 100)]),
    ('egg', '01123', 'Egg', 'Ei Eier', 'Meat & fish', [('1 egg (M)', 50), ('1 egg (L)', 58)]),
    ('egg-boiled', '01129', 'Hard-boiled egg', 'Ei gekocht hart', 'Meat & fish', [('1 egg', 50)]),
    ('egg-white', '01124', 'Egg white', 'Eiklar Eiweiß', 'Meat & fish', [('1 egg white', 33)]),
    # Dairy
    ('milk', '01174', 'Milk 2%', 'Milch fettarm Halbfett', 'Dairy', [('1 glass', 250)]),
    ('milk-whole', '01211', 'Whole milk 3.5%', 'Vollmilch Milch', 'Dairy', [('1 glass', 250)]),
    ('greek-yogurt', '01256', 'Greek yogurt (non-fat)', 'Joghurt griechisch Skyr Magerjoghurt', 'Dairy', [('1 portion', 170)]),
    ('greek-yogurt-full', '01293', 'Greek yogurt (whole milk)', 'Joghurt griechisch', 'Dairy', [('1 portion', 150)]),
    ('yogurt', '01117', 'Plain yogurt (low fat)', 'Joghurt Naturjoghurt', 'Dairy', [('1 cup', 150)]),
    ('kefir', '01289', 'Kefir', 'Kefir Buttermilch', 'Dairy', [('1 glass', 250)]),
    ('cottage-cheese', '01015', 'Cottage cheese', 'Hüttenkäse Cottage Cheese Topfen', 'Dairy', [('1 portion', 125)]),
    ('mozzarella', '01028', 'Mozzarella', 'Mozzarella Käse', 'Dairy', [('1/2 ball', 60)]),
    ('cheddar', '01009', 'Cheddar', 'Cheddar Käse', 'Dairy', [('1 slice', 28)]),
    ('gouda', '01022', 'Gouda', 'Gouda Käse', 'Dairy', [('1 slice', 25)]),
    ('emmentaler', '01040', 'Swiss cheese (Emmental)', 'Emmentaler Schweizer Käse', 'Dairy', [('1 slice', 25)]),
    ('feta', '01019', 'Feta', 'Feta Schafkäse', 'Dairy', [('1 portion', 50)]),
    ('parmesan', '01032', 'Parmesan', 'Parmesan Parmigiano', 'Dairy', [('1 tbsp', 5)]),
    ('cream-cheese', '01017', 'Cream cheese', 'Frischkäse', 'Dairy', [('1 tbsp', 15)]),
    ('ricotta', '01037', 'Ricotta', 'Ricotta', 'Dairy', [('1 portion', 60)]),
    ('cream', '01053', 'Heavy cream', 'Schlagobers Sahne Schlagsahne', 'Dairy', [('1 tbsp', 15)]),
    ('sour-cream', '01178', 'Sour cream', 'Sauerrahm Schmand', 'Dairy', [('1 tbsp', 15)]),
    ('butter', '01001', 'Butter', 'Butter', 'Dairy', [('1 tsp', 5), ('1 tbsp', 14)]),
    ('whey', '14066', 'Whey protein powder', 'Proteinpulver Eiweißpulver Whey Protein Shake', 'Dairy', [('1 scoop', 30)]),
    ('almond-milk', '14091', 'Almond drink (unsweetened)', 'Mandelmilch Mandeldrink', 'Dairy', [('1 glass', 250)]),
    ('soy-milk', '16222', 'Soy drink (unsweetened)', 'Sojamilch Sojadrink', 'Dairy', [('1 glass', 250)]),
    # Legumes, nuts, seeds
    ('lentils', '16070', 'Lentils (cooked)', 'Linsen', 'Legumes & nuts', [('1 portion', 150)]),
    ('chickpeas', '16358', 'Chickpeas (canned, drained)', 'Kichererbsen', 'Legumes & nuts', [('1/2 can', 120)]),
    ('kidney-beans', '16145', 'Kidney beans (canned, drained)', 'Kidneybohnen rote Bohnen', 'Legumes & nuts', [('1/2 can', 120)]),
    ('black-beans', '16018', 'Black beans (canned)', 'schwarze Bohnen', 'Legumes & nuts', [('1/2 can', 120)]),
    ('tofu', '16126', 'Tofu (firm)', 'Tofu', 'Legumes & nuts', [('1 portion', 100)]),
    ('hummus', '16158', 'Hummus', 'Hummus', 'Legumes & nuts', [('1 tbsp', 15)]),
    ('peanut-butter', '16098', 'Peanut butter', 'Erdnussbutter Erdnussmus', 'Legumes & nuts', [('1 tbsp', 16)]),
    ('peanuts', '16090', 'Peanuts (roasted, salted)', 'Erdnüsse', 'Legumes & nuts', [('1 handful', 30)]),
    ('almonds', '12061', 'Almonds', 'Mandeln', 'Legumes & nuts', [('1 handful', 30)]),
    ('walnuts', '12155', 'Walnuts', 'Walnüsse Nüsse', 'Legumes & nuts', [('1 handful', 30)]),
    ('cashews', '12087', 'Cashews', 'Cashewnüsse Cashew', 'Legumes & nuts', [('1 handful', 30)]),
    ('chia', '12006', 'Chia seeds', 'Chiasamen Chia', 'Legumes & nuts', [('1 tbsp', 12)]),
    ('flaxseed', '12220', 'Flaxseed', 'Leinsamen', 'Legumes & nuts', [('1 tbsp', 10)]),
    ('sunflower-seeds', '12036', 'Sunflower seeds', 'Sonnenblumenkerne', 'Legumes & nuts', [('1 tbsp', 10)]),
    # Fats, sauces, extras
    ('olive-oil', '04053', 'Olive oil', 'Olivenöl Öl', 'Fats & extras', [('1 tsp', 4.5), ('1 tbsp', 13.5)]),
    ('mayonnaise', '04025', 'Mayonnaise', 'Mayonnaise Mayo', 'Fats & extras', [('1 tbsp', 14)]),
    ('ketchup', '11935', 'Ketchup', 'Ketchup', 'Fats & extras', [('1 tbsp', 17)]),
    ('mustard', '02046', 'Mustard', 'Senf', 'Fats & extras', [('1 tsp', 5)]),
    ('soy-sauce', '16123', 'Soy sauce', 'Sojasauce Sojasoße', 'Fats & extras', [('1 tbsp', 16)]),
    ('pesto', '06626', 'Pesto', 'Pesto', 'Fats & extras', [('1 tbsp', 16)]),
    ('tomato-sauce', '11549', 'Tomato sauce', 'Tomatensauce Tomatensoße Sugo', 'Fats & extras', [('1 portion', 125)]),
    ('balsamic', '02069', 'Balsamic vinegar', 'Balsamico Essig', 'Fats & extras', [('1 tbsp', 16)]),
    ('honey', '19296', 'Honey', 'Honig', 'Fats & extras', [('1 tsp', 7), ('1 tbsp', 21)]),
    ('maple-syrup', '19353', 'Maple syrup', 'Ahornsirup', 'Fats & extras', [('1 tbsp', 20)]),
    ('jam', '19297', 'Jam', 'Marmelade Konfitüre', 'Fats & extras', [('1 tbsp', 20)]),
    ('sugar', '19335', 'Sugar', 'Zucker', 'Fats & extras', [('1 tsp', 4)]),
    ('cinnamon', '02010', 'Cinnamon', 'Zimt', 'Fats & extras', [('1 tsp', 2.6)]),
    # Snacks and sweets
    ('dark-chocolate', '19904', 'Dark chocolate 70-85%', 'Bitterschokolade Zartbitter Schokolade', 'Snacks & sweets', [('1 row', 20)]),
    ('chips', '19411', 'Potato chips', 'Chips Kartoffelchips', 'Snacks & sweets', [('1 handful', 30)]),
    ('cookie', '18160', 'Chocolate chip cookie', 'Keks Cookie', 'Snacks & sweets', [('1 cookie', 15)]),
    ('ice-cream', '19095', 'Vanilla ice cream', 'Eis Vanilleeis', 'Snacks & sweets', [('1 scoop', 66)]),
    ('pizza', '21224', 'Cheese pizza', 'Pizza Margherita', 'Snacks & sweets', [('1 slice', 107), ('1 pizza', 350)]),
    ('pancakes', '18293', 'Pancakes', 'Palatschinken Pfannkuchen Pancakes', 'Snacks & sweets', [('1 pancake', 77)]),
    ('muffin', '18274', 'Blueberry muffin', 'Muffin', 'Snacks & sweets', [('1 muffin', 113)]),
    # Drinks
    ('orange-juice', '09206', 'Orange juice', 'Orangensaft O-Saft', 'Drinks', [('1 glass', 250)]),
    ('coffee', '14209', 'Coffee (black)', 'Kaffee schwarz Espresso', 'Drinks', [('1 cup', 240)]),
    ('tea', '14355', 'Tea (black)', 'Tee Schwarztee', 'Drinks', [('1 cup', 240)]),
    ('cola', '14148', 'Cola', 'Cola Limonade Softdrink', 'Drinks', [('1 can', 330)]),
    ('energy-drink', '14154', 'Energy drink', 'Energydrink Energy', 'Drinks', [('1 can', 250)]),
    ('energy-drink-zero', '14156', 'Energy drink (sugar free)', 'Energydrink zuckerfrei', 'Drinks', [('1 can', 250)]),
    ('wine-red', '14096', 'Red wine', 'Rotwein Wein', 'Drinks', [('1 glass', 125)]),
]


def num(s: str):
    s = s.strip()
    return float(s) if s else None


def main(abbrev: Path):
    rows = {}
    for line in abbrev.read_text(encoding='latin-1').splitlines():
        f = line.split('^')
        rows[f[0].strip('~')] = f
    out = []
    keys = set()
    for key, ndb, name, words, cat, servings in FOODS:
        assert key not in keys, f'duplicate {key}'
        keys.add(key)
        f = rows[ndb]
        n = {}
        for k, i in COL.items():
            v = num(f[i])
            if v is None:
                continue
            if k == 'sodium':
                n['salt'] = round(v * 2.5 / 1000, 3)
            else:
                n[k] = round(v, 3)
        out.append({
            'key': key, 'ndb': ndb, 'name': name, 'words': words, 'category': cat,
            'servings': [{'label': l, 'g': g} for l, g in servings], 'n': n,
        })
    dest = Path(__file__).resolve().parent.parent / 'src/lib/food-data.json'
    dest.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'{len(out)} foods -> {dest} ({dest.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main(Path(sys.argv[1]))
