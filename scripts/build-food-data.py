#!/usr/bin/env python3
"""Builds the app's food data.

Main source: Bundeslebensmittelschlüssel (BLS) 4.0, the German national nutrient
database of the Max Rubner-Institut, published under CC BY 4.0:
  Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 -
  Deutsche Nährstoffdatenbank. Karlsruhe. DOI: 10.25826/Data20251217-134202-0
  https://blsdb.de  (download: BLS_4_0_2025_DE.zip -> BLS_4_0_Daten_2025_DE.xlsx)

Usage:
  python3 scripts/build-food-data.py BLS_4_0_Daten_2025_DE.xlsx

Outputs (all values per 100 g edible portion):
  src/lib/food-data.json  everyday foods with portion sizes and search words
  src/lib/bls-data.json   every other BLS food, compact rows, searchable in German
"""
import json
import re
import sys
from pathlib import Path

import openpyxl

KEYS = ['kcal', 'protein', 'fat', 'carbs', 'fiber', 'sugar', 'satFat', 'salt',
        'potassium', 'calcium', 'magnesium', 'iron', 'zinc', 'vitC', 'vitD', 'vitB12']

# BLS component codes (first word of each column header).
BLS = {'ENERCC': 'kcal', 'PROT625': 'protein', 'FAT': 'fat', 'CHO': 'carbs', 'FIBT': 'fiber',
       'SUGAR': 'sugar', 'FASAT': 'satFat', 'NACL': 'salt', 'K': 'potassium', 'CA': 'calcium',
       'MG': 'magnesium', 'FE': 'iron', 'ZN': 'zinc', 'VITC': 'vitC', 'VITD': 'vitD', 'VITB12': 'vitB12'}

# Austrian words people type, added to the German names they mean.
AUSTRIAN = [
    (r'Quark', 'Topfen'), (r'Sahne', 'Obers Schlagobers Rahm'), (r'Kartoffel', 'Erdapfel Erdäpfel'),
    (r'Brötchen', 'Semmel Weckerl'), (r'Tomate', 'Paradeiser'), (r'Hackfleisch', 'Faschiertes'),
    (r'Pfannkuchen|Eierkuchen', 'Palatschinken'), (r'Aprikose', 'Marille'), (r'Pflaume', 'Zwetschke Zwetschge'),
    (r'Blumenkohl', 'Karfiol'), (r'Bohne grün|Gartenbohne', 'Fisolen'), (r'Meerrettich', 'Kren'),
    (r'Rosenkohl', 'Kohlsprossen'), (r'Aubergine', 'Melanzani'), (r'Hähnchen|Huhn', 'Hendl Hühnchen'),
    (r'Mais', 'Kukuruz'), (r'Johannisbeere', 'Ribisel'), (r'Pfifferling', 'Eierschwammerl'),
    (r'Weißkohl', 'Kraut'), (r'Möhre|Karotte', 'Karotte'), (r'Hefe', 'Germ'), (r'Sauerrahm|Saure Sahne', 'Sauerrahm'),
    (r'Pute', 'Truthahn'), (r'Fleischkäse', 'Leberkäse'), (r'Grieß', 'Grieß'), (r'Hühnerei', 'Ei Eier'),
    (r'Rote Bete|Rote Rübe', 'Rote Rüben Rahnen'), (r'Feldsalat', 'Vogerlsalat'), (r'Konfitüre', 'Marmelade'),
    (r'Puderzucker', 'Staubzucker'), (r'Krapfen|Berliner', 'Krapfen'), (r'Kloß|Klöße', 'Knödel'),
    (r'Wiener Würstchen', 'Frankfurter Würstel'), (r'Würstchen', 'Würstel'), (r'Schlagsahne', 'Schlagobers'),
    (r'Speisequark', 'Topfen'), (r'Kürbis', 'Kürbis'),
]

FOODS = [
    # Fruit
    ('banana', 'bls:F503100', 'Banana', 'Banane', 'Fruit', [('1 medium', 118)]),
    ('apple', 'bls:F110100', 'Apple', 'Apfel', 'Fruit', [('1 medium', 182)]),
    ('orange', 'bls:F603100', 'Orange', 'Orange Apfelsine', 'Fruit', [('1 medium', 140)]),
    ('pear', 'bls:F130100', 'Pear', 'Birne', 'Fruit', [('1 medium', 178)]),
    ('kiwi', 'bls:F514100', 'Kiwi', 'Kiwi', 'Fruit', [('1 kiwi', 69)]),
    ('grapes', 'bls:F310100', 'Grapes', 'Weintrauben Trauben', 'Fruit', [('1 handful', 80)]),
    ('strawberries', 'bls:F301100', 'Strawberries', 'Erdbeeren', 'Fruit', [('1 handful', 100)]),
    ('blueberries', 'bls:F304100', 'Blueberries', 'Heidelbeeren Blaubeeren', 'Fruit', [('1 handful', 75)]),
    ('raspberries', 'bls:F302100', 'Raspberries', 'Himbeeren', 'Fruit', [('1 handful', 75)]),
    ('pineapple', 'bls:F501100', 'Pineapple', 'Ananas', 'Fruit', [('1 slice', 85)]),
    ('mango', 'bls:F516100', 'Mango', 'Mango', 'Fruit', [('1/2 mango', 165)]),
    ('peach', 'bls:F203100', 'Peach', 'Pfirsich', 'Fruit', [('1 medium', 150)]),
    ('watermelon', 'bls:F535100', 'Watermelon', 'Wassermelone', 'Fruit', [('1 slice', 280)]),
    ('cherries', 'bls:F211100', 'Cherries', 'Kirschen', 'Fruit', [('1 handful', 100)]),
    ('plum', 'bls:F220100', 'Plum', 'Zwetschke Pflaume', 'Fruit', [('1 plum', 66)]),
    ('apricot', 'bls:F201100', 'Apricot', 'Marille Aprikose', 'Fruit', [('1 apricot', 35)]),
    ('lemon', 'bls:F601100', 'Lemon', 'Zitrone', 'Fruit', [('1 lemon', 58)]),
    ('avocado', 'bls:F502100', 'Avocado', 'Avocado', 'Fruit', [('1/2 avocado', 75)]),
    ('dates', 'bls:F504400', 'Dates (dried)', 'Datteln', 'Fruit', [('1 date', 24)]),
    ('raisins', 'bls:F840100', 'Raisins', 'Rosinen', 'Fruit', [('1 tbsp', 10)]),
    # Vegetables
    ('broccoli', 'bls:G312100', 'Broccoli', 'Brokkoli', 'Vegetables', [('1 portion', 150)]),
    ('spinach', 'bls:G211100', 'Spinach', 'Spinat Blattspinat', 'Vegetables', [('1 handful', 30)]),
    ('tomato', 'bls:G561100', 'Tomato', 'Tomate Paradeiser', 'Vegetables', [('1 medium', 123)]),
    ('cucumber', 'bls:G520100', 'Cucumber', 'Gurke Salatgurke', 'Vegetables', [('1/2 cucumber', 150)]),
    ('bell-pepper', 'bls:G543100', 'Red bell pepper', 'Paprika rot', 'Vegetables', [('1 pepper', 120)]),
    ('carrot', 'bls:G620100', 'Carrot', 'Karotte Möhre', 'Vegetables', [('1 medium', 61)]),
    ('onion', 'bls:G480100', 'Onion', 'Zwiebel', 'Vegetables', [('1 medium', 110)]),
    ('garlic', 'bls:G490100', 'Garlic', 'Knoblauch', 'Vegetables', [('1 clove', 3)]),
    ('zucchini', 'bls:G582100', 'Zucchini', 'Zucchini', 'Vegetables', [('1 medium', 200)]),
    ('mushrooms', 'bls:K701100', 'Mushrooms', 'Champignons Pilze', 'Vegetables', [('1 portion', 100)]),
    ('lettuce', 'bls:G107100', 'Romaine lettuce', 'Salat Römersalat Blattsalat', 'Vegetables', [('1 bowl', 50)]),
    ('cauliflower', 'bls:G311100', 'Cauliflower', 'Karfiol Blumenkohl', 'Vegetables', [('1 portion', 150)]),
    ('green-beans', 'bls:G710100', 'Green beans', 'Fisolen grüne Bohnen', 'Vegetables', [('1 portion', 125)]),
    ('asparagus', 'bls:G450100', 'Asparagus', 'Spargel', 'Vegetables', [('1 portion', 150)]),
    ('cabbage', 'bls:G342100', 'Cabbage', 'Kraut Weißkohl', 'Vegetables', [('1 portion', 100)]),
    ('kale', 'bls:G322100', 'Kale', 'Grünkohl', 'Vegetables', [('1 handful', 30)]),
    ('celery', 'bls:G220100', 'Celery', 'Stangensellerie', 'Vegetables', [('1 stalk', 40)]),
    ('peas', 'bls:G760200', 'Green peas (frozen)', 'Erbsen', 'Vegetables', [('1 portion', 80)]),
    ('corn', 'bls:G570902', 'Sweet corn (canned)', 'Mais', 'Vegetables', [('1 portion', 80)]),
    ('potato', 'bls:K110132', 'Potato (boiled)', 'Kartoffel Erdapfel', 'Vegetables', [('1 medium', 173)]),
    ('potato-raw', 'bls:K110100', 'Potato (raw)', 'Kartoffel Erdapfel roh', 'Vegetables', [('1 medium', 213)]),
    ('sweet-potato', 'bls:K420162', 'Sweet potato (baked)', 'Süßkartoffel', 'Vegetables', [('1 medium', 114)]),
    ('tomatoes-canned', 'bls:G568900', 'Crushed tomatoes (canned)', 'Tomaten Dose passiert Paradeiser', 'Vegetables', [('1/2 can', 200)]),
    ('olives', 'bls:H520800', 'Black olives', 'Oliven', 'Vegetables', [('5 olives', 20)]),
    ('edamame', 'bls:G750100', 'Edamame', 'Edamame Sojabohnen', 'Vegetables', [('1 portion', 100)]),
    # Grains and bread
    ('oats', 'bls:C133000', 'Rolled oats', 'Haferflocken Hafer', 'Grains', [('1 portion', 50)]),
    ('granola', 'bls:C514200', 'Granola', 'Müsli Granola Knuspermüsli', 'Grains', [('1 portion', 50)]),
    ('rice', 'bls:C352032', 'White rice (cooked)', 'Reis gekocht', 'Grains', [('1 portion', 180)]),
    ('rice-dry', 'bls:C352000', 'White rice (dry)', 'Reis roh trocken', 'Grains', [('1 portion', 75)]),
    ('brown-rice', 'bls:C351032', 'Brown rice (cooked)', 'Vollkornreis Naturreis', 'Grains', [('1 portion', 180)]),
    ('pasta', 'bls:E401032', 'Pasta (cooked)', 'Nudeln Pasta Spaghetti gekocht', 'Grains', [('1 portion', 200)]),
    ('pasta-dry', 'bls:E401000', 'Pasta (dry)', 'Nudeln Pasta Spaghetti roh trocken', 'Grains', [('1 portion', 100)]),
    ('pasta-wholewheat', 'bls:E500032', 'Whole-wheat pasta (cooked)', 'Vollkornnudeln', 'Grains', [('1 portion', 200)]),
    ('noodles-rice', 'bls:C559032', 'Rice noodles (cooked)', 'Reisnudeln', 'Grains', [('1 portion', 175)]),
    ('quinoa', 'bls:C118032', 'Quinoa (cooked)', 'Quinoa', 'Grains', [('1 portion', 185)]),
    ('couscous', 'bls:C119232', 'Couscous (cooked)', 'Couscous', 'Grains', [('1 portion', 160)]),
    ('bulgur', 'bls:C119132', 'Bulgur (cooked)', 'Bulgur', 'Grains', [('1 portion', 180)]),
    ('bread-wholewheat', 'bls:B111000', 'Whole-wheat bread', 'Vollkornbrot Brot', 'Grains', [('1 slice', 40)]),
    ('bread-white', 'bls:B314000', 'Toast bread', 'Weißbrot Toast Toastbrot', 'Grains', [('1 slice', 30)]),
    ('bread-rye', 'bls:B271000', 'Rye mixed bread', 'Roggenbrot Schwarzbrot Brot', 'Grains', [('1 slice', 45)]),
    ('bread-multigrain', 'bls:B291000', 'Multigrain bread', 'Mehrkornbrot Körnerbrot', 'Grains', [('1 slice', 45)]),
    ('roll', 'bls:B511000', 'Bread roll', 'Semmel Brötchen Weckerl', 'Grains', [('1 roll', 50)]),
    ('pita', 'bls:B782100', 'Pita bread', 'Pita Fladenbrot', 'Grains', [('1 pita', 60)]),
    ('tortilla', 'bls:B783012', 'Flour tortilla / wrap', 'Tortilla Wrap', 'Grains', [('1 wrap', 60)]),
    ('croissant', 'bls:D771600', 'Croissant', 'Croissant Kipferl', 'Grains', [('1 croissant', 57)]),
    ('rice-cakes', 'bls:C532700', 'Rice cakes', 'Reiswaffeln', 'Grains', [('1 cake', 9)]),
    ('flour', 'bls:C214100', 'Wheat flour', 'Mehl Weizenmehl', 'Grains', [('1 tbsp', 8)]),
    # Meat, fish, eggs
    ('chicken-breast', 'bls:V4A6182', 'Chicken breast (pan-fried)', 'Hühnerbrust Hähnchenbrust Huhn gebraten', 'Meat & fish', [('1 portion', 150)]),
    ('chicken-breast-raw', 'bls:V416100', 'Chicken breast (raw)', 'Hühnerbrust Hähnchenbrust Huhn roh', 'Meat & fish', [('1 fillet', 175)]),
    ('turkey-breast', 'bls:V486100', 'Turkey breast (raw)', 'Putenbrust Truthahn Pute', 'Meat & fish', [('1 portion', 150)]),
    ('beef-mince', 'bls:U010100', 'Beef mince (raw)', 'Faschiertes Rinderhack Hackfleisch', 'Meat & fish', [('1 portion', 125)]),
    ('beef-mince-cooked', 'bls:U010182', 'Beef mince (pan-fried)', 'Faschiertes Rinderhack gebraten', 'Meat & fish', [('1 portion', 100)]),
    ('pork-tenderloin', 'bls:U611100', 'Pork tenderloin (raw)', 'Schweinefilet Schwein', 'Meat & fish', [('1 portion', 150)]),
    ('ham', 'bls:W424000', 'Ham (sliced)', 'Schinken Kochschinken', 'Meat & fish', [('1 slice', 20)]),
    ('leberkaese', 'bls:W233000', 'Leberkäse', 'Leberkäse Fleischkäse Leberkässemmel', 'Meat & fish', [('1 slice', 100)]),
    ('pork-schnitzel', 'bls:U541100', 'Pork schnitzel (raw)', 'Schnitzel Schweineschnitzel', 'Meat & fish', [('1 schnitzel', 150)]),
    ('frankfurter', 'bls:W211200', 'Wiener sausages', 'Frankfurter Würstel Wurst', 'Meat & fish', [('1 pair', 90)]),
    ('salmon', 'bls:T410082', 'Salmon (pan-fried)', 'Lachs gebraten', 'Meat & fish', [('1 fillet', 125)]),
    ('salmon-raw', 'bls:T410100', 'Salmon (raw)', 'Lachs roh Lachsfilet', 'Meat & fish', [('1 fillet', 125)]),
    ('cod', 'bls:T204100', 'Cod (raw)', 'Kabeljau Dorsch Fisch', 'Meat & fish', [('1 fillet', 150)]),
    ('tuna', 'bls:T121902', 'Tuna in water (canned)', 'Thunfisch Dose', 'Meat & fish', [('1 can', 120)]),
    ('shrimp', 'bls:T753100', 'Shrimp (raw)', 'Garnelen Shrimps Crevetten', 'Meat & fish', [('1 portion', 100)]),
    ('egg', 'bls:E111100', 'Egg', 'Ei Eier', 'Meat & fish', [('1 egg (M)', 50), ('1 egg (L)', 58)]),
    ('egg-boiled', 'bls:E111132', 'Hard-boiled egg', 'Ei gekocht hart', 'Meat & fish', [('1 egg', 50)]),
    ('egg-white', 'bls:E113100', 'Egg white', 'Eiklar Eiweiß', 'Meat & fish', [('1 egg white', 33)]),
    # Dairy
    ('milk', 'bls:M111200', 'Milk 1.5%', 'Milch fettarm Halbfett', 'Dairy', [('1 glass', 250)]),
    ('milk-whole', 'bls:M111300', 'Whole milk 3.5%', 'Vollmilch Milch', 'Dairy', [('1 glass', 250)]),
    ('skyr', 'bls:M710100', 'Skyr', 'Skyr Joghurt griechisch Greek yogurt Magerjoghurt Protein', 'Dairy', [('1 cup', 150)]),
    ('yogurt-full', 'bls:M141300', 'Plain yogurt 3.5%', 'Joghurt Naturjoghurt griechisch', 'Dairy', [('1 cup', 150)]),
    ('yogurt', 'bls:M141200', 'Plain yogurt 1.5%', 'Joghurt Naturjoghurt', 'Dairy', [('1 cup', 150)]),
    ('kefir', 'bls:M130200', 'Kefir', 'Kefir Buttermilch', 'Dairy', [('1 glass', 250)]),
    ('cottage-cheese', 'bls:M711100', 'Cottage cheese', 'Hüttenkäse Cottage Cheese Topfen', 'Dairy', [('1 portion', 125)]),
    ('mozzarella', 'bls:M032100', 'Mozzarella', 'Mozzarella Käse', 'Dairy', [('1/2 ball', 60)]),
    ('cheddar', 'bls:M303600', 'Cheddar', 'Cheddar Käse', 'Dairy', [('1 slice', 28)]),
    ('gouda', 'bls:M402600', 'Gouda', 'Gouda Käse', 'Dairy', [('1 slice', 25)]),
    ('emmentaler', 'bls:M304600', 'Swiss cheese (Emmental)', 'Emmentaler Schweizer Käse', 'Dairy', [('1 slice', 25)]),
    ('feta', 'bls:M012200', 'Feta', 'Feta Schafkäse', 'Dairy', [('1 portion', 50)]),
    ('parmesan', 'bls:M306400', 'Parmesan', 'Parmesan Parmigiano', 'Dairy', [('1 tbsp', 5)]),
    ('cream-cheese', 'bls:M710800', 'Cream cheese', 'Frischkäse', 'Dairy', [('1 tbsp', 15)]),
    ('ricotta', 'bls:M741600', 'Ricotta', 'Ricotta', 'Dairy', [('1 portion', 60)]),
    ('cream', 'bls:M173900', 'Whipping cream 36%', 'Schlagobers Sahne Schlagsahne', 'Dairy', [('1 tbsp', 15)]),
    ('sour-cream', 'bls:M172500', 'Sour cream 10%', 'Sauerrahm Schmand', 'Dairy', [('1 tbsp', 15)]),
    ('butter', 'bls:Q611000', 'Butter', 'Butter', 'Dairy', [('1 tsp', 5), ('1 tbsp', 14)]),
    ('quark', 'bls:M713100', 'Low-fat quark (Topfen)', 'Topfen Magertopfen Quark Magerquark', 'Dairy', [('1/2 tub', 125), ('1 tub', 250)]),
    ('almond-milk', 'bls:H800000', 'Almond drink (unsweetened)', 'Mandelmilch Mandeldrink', 'Dairy', [('1 glass', 250)]),
    ('soy-milk', 'bls:H841100', 'Soy drink (unsweetened)', 'Sojamilch Sojadrink', 'Dairy', [('1 glass', 250)]),
    # Legumes, nuts, seeds
    ('lentils', 'bls:H730132', 'Lentils (cooked)', 'Linsen', 'Legumes & nuts', [('1 portion', 150)]),
    ('chickpeas', 'bls:G770432', 'Chickpeas (cooked)', 'Kichererbsen', 'Legumes & nuts', [('1/2 can', 120)]),
    ('kidney-beans', 'bls:H742902', 'Kidney beans (canned)', 'Kidneybohnen rote Bohnen', 'Legumes & nuts', [('1/2 can', 120)]),
    ('tofu', 'bls:H861000', 'Tofu', 'Tofu', 'Legumes & nuts', [('1 portion', 100)]),
    ('hummus', 'bls:H960000', 'Hummus', 'Hummus', 'Legumes & nuts', [('1 tbsp', 15)]),
    ('peanut-butter', 'bls:H880200', 'Peanut butter', 'Erdnussbutter Erdnussmus', 'Legumes & nuts', [('1 tbsp', 16)]),
    ('peanuts', 'bls:H110700', 'Peanuts (roasted, salted)', 'Erdnüsse', 'Legumes & nuts', [('1 handful', 30)]),
    ('almonds', 'bls:H210100', 'Almonds', 'Mandeln', 'Legumes & nuts', [('1 handful', 30)]),
    ('walnuts', 'bls:H120100', 'Walnuts', 'Walnüsse Nüsse', 'Legumes & nuts', [('1 handful', 30)]),
    ('cashews', 'bls:H170100', 'Cashews', 'Cashewnüsse Cashew', 'Legumes & nuts', [('1 handful', 30)]),
    ('chia', 'bls:H480100', 'Chia seeds', 'Chiasamen Chia', 'Legumes & nuts', [('1 tbsp', 12)]),
    ('flaxseed', 'bls:H410100', 'Flaxseed', 'Leinsamen', 'Legumes & nuts', [('1 tbsp', 10)]),
    ('sunflower-seeds', 'bls:H430100', 'Sunflower seeds', 'Sonnenblumenkerne', 'Legumes & nuts', [('1 tbsp', 10)]),
    # Fats, sauces, extras
    ('olive-oil', 'bls:Q120000', 'Olive oil', 'Olivenöl Öl', 'Fats & extras', [('1 tsp', 4.5), ('1 tbsp', 13.5)]),
    ('mayonnaise', 'bls:Q991000', 'Mayonnaise', 'Mayonnaise Mayo', 'Fats & extras', [('1 tbsp', 14)]),
    ('ketchup', 'bls:R141100', 'Ketchup', 'Ketchup', 'Fats & extras', [('1 tbsp', 17)]),
    ('mustard', 'bls:R132000', 'Mustard', 'Senf', 'Fats & extras', [('1 tsp', 5)]),
    ('soy-sauce', 'bls:R143000', 'Soy sauce', 'Sojasauce Sojasoße', 'Fats & extras', [('1 tbsp', 16)]),
    ('pesto', 'bls:X372012', 'Pesto', 'Pesto', 'Fats & extras', [('1 tbsp', 16)]),
    ('tomato-sauce', 'bls:R161200', 'Tomato passata', 'Tomatensauce Tomatensoße Sugo', 'Fats & extras', [('1 portion', 125)]),
    ('balsamic', 'bls:R125000', 'Balsamic vinegar', 'Balsamico Essig', 'Fats & extras', [('1 tbsp', 16)]),
    ('honey', 'bls:S120000', 'Honey', 'Honig', 'Fats & extras', [('1 tsp', 7), ('1 tbsp', 21)]),
    ('maple-syrup', 'bls:S151100', 'Maple syrup', 'Ahornsirup', 'Fats & extras', [('1 tbsp', 20)]),
    ('jam', 'bls:S132000', 'Jam', 'Marmelade Konfitüre', 'Fats & extras', [('1 tbsp', 20)]),
    ('sugar', 'bls:S111000', 'Sugar', 'Zucker', 'Fats & extras', [('1 tsp', 4)]),
    # Snacks and sweets
    ('milk-chocolate', 'bls:S530000', 'Milk chocolate', 'Milchschokolade Schokolade', 'Snacks & sweets', [('1 row', 20)]),
    ('chips', 'bls:K280100', 'Potato chips', 'Chips Kartoffelchips', 'Snacks & sweets', [('1 handful', 30)]),
    ('cookie', 'bls:D7A2000', 'Chocolate chip cookie', 'Keks Cookie', 'Snacks & sweets', [('1 cookie', 15)]),
    ('ice-cream', 'bls:S241000', 'Vanilla ice cream', 'Eis Vanilleeis', 'Snacks & sweets', [('1 scoop', 66)]),
    ('pizza', 'bls:X912033', 'Pizza Margherita', 'Pizza Margherita', 'Snacks & sweets', [('1 slice', 107), ('1 pizza', 350)]),
    ('pancakes', 'bls:X929212', 'Pancakes (Palatschinken)', 'Palatschinken Pfannkuchen Pancakes', 'Snacks & sweets', [('1 pancake', 77)]),
    ('muffin', 'bls:D400800', 'Blueberry muffin', 'Muffin', 'Snacks & sweets', [('1 muffin', 113)]),
    # Drinks
    ('orange-juice', 'bls:F603600', 'Orange juice', 'Orangensaft O-Saft', 'Drinks', [('1 glass', 250)]),
    ('coffee', 'bls:N410100', 'Coffee (black)', 'Kaffee schwarz Espresso', 'Drinks', [('1 cup', 240)]),
    ('tea', 'bls:N630000', 'Tea (black)', 'Tee Schwarztee', 'Drinks', [('1 cup', 240)]),
    ('cola', 'bls:N330000', 'Cola', 'Cola Limonade Softdrink', 'Drinks', [('1 can', 330)]),
    ('cola-zero', 'bls:N331000', 'Cola zero (sweeteners)', 'Cola Zero light zuckerfrei', 'Drinks', [('1 can', 330)]),
    ('wine-red', 'bls:P2A3000', 'Red wine (dry)', 'Rotwein Wein', 'Drinks', [('1 glass', 125)]),
]


TEXT_ZERO = {'<LOD', '<LOQ', 'TR', '<LOD or <LOQ'}


def value(v):
    """Numbers stay numbers; below detection limit / traces count as 0; '-' means unknown."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    t = str(v).strip()
    if t in TEXT_ZERO:
        return 0.0
    try:
        return float(t.replace(',', '.'))
    except ValueError:
        return None


def read_bls(path: Path) -> dict:
    wb = openpyxl.load_workbook(path, read_only=True)
    rows = wb.worksheets[0].iter_rows(values_only=True)
    head = next(rows)
    cols = {}
    for i, h in enumerate(head):
        code = str(h or '').split(' ')[0]
        if code in BLS and BLS[code] not in cols:
            cols[BLS[code]] = i
    assert len(cols) == len(BLS), f'missing BLS columns: {set(BLS.values()) - set(cols)}'
    out = {}
    for r in rows:
        if not r[0]:
            continue
        n = {}
        for k, i in cols.items():
            v = value(r[i])
            if v is not None:
                n[k] = round(v, 3)
        out[str(r[0]).strip()] = {'de': str(r[1]).strip(), 'en': str(r[2]).strip(), 'n': n}
    return out


def austrian_words(de: str) -> str:
    extra = [w for pat, w in AUSTRIAN if re.search(pat, de)]
    return ' '.join(extra)


def main(bls_path: Path):
    bls = read_bls(bls_path)
    root = Path(__file__).resolve().parent.parent / 'src/lib'

    curated, used, keys = [], set(), set()
    for key, src, name, words, cat, servings in FOODS:
        assert key not in keys, f'duplicate {key}'
        keys.add(key)
        code = src.removeprefix('bls:')
        row = bls[code]
        used.add(code)
        n = row['n']
        words = f"{words} {row['de']} {austrian_words(row['de'])}".strip()
        curated.append({'key': key, 'code': code, 'name': name, 'words': words, 'category': cat,
                        'servings': [{'label': l, 'g': g} for l, g in servings], 'n': n})
    (root / 'food-data.json').write_text(json.dumps(curated, ensure_ascii=False, separators=(',', ':')) + '\n',
                                         encoding='utf-8')

    # Every other BLS food: [code, English name, German name, extra words, *values in KEYS order]
    rows = []
    for code, row in bls.items():
        if code in used:
            continue
        n = row['n']
        if n.get('kcal') is None:
            continue
        vals = [n.get(k) for k in KEYS]
        vals = [None if v is None else (int(v) if v == int(v) else v) for v in vals]
        rows.append([code, row['en'], row['de'], austrian_words(row['de'])] + vals)
    (root / 'bls-data.json').write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')) + '\n',
                                        encoding='utf-8')
    for f in ('food-data.json', 'bls-data.json'):
        print(f, (root / f).stat().st_size // 1024, 'KB')
    print(len(curated), 'everyday foods with portions,', len(rows), 'more BLS foods')


if __name__ == '__main__':
    main(Path(sys.argv[1]))
