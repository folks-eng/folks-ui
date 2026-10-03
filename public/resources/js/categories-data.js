/* =========================================================================
   HEARTH — categories-data.js

   Clean, scalable 3-tier data model consumed by categories.js:

     Category (id, name, icon, image, tagline)
       └─ SubCategory (id, name, image)
            └─ Service SKU (id, name, price, currency, duration,
                             durationMinutes, rating, reviews,
                             description, isPopular)

   Every tier carries a real, relevant "image" field. Category/subcategory
   images are sourced photos; each service inherits its subcategory's image
   for its card thumbnail (services within a subcategory are visually
   related, e.g. all Women's Salon services share that subcategory photo).

   This file holds DATA ONLY — no DOM, no rendering, no styling — so it can
   be swapped for a real API response later with no changes to the shape
   consumers rely on.

   SELECT a.category_id, a.name AS category_name, a.icon, a.image AS category_image, a.tag_line, b.category_id AS sub_category_id, b.name AS sub_category_name, b.image AS sub_category_image, c.service_id, c.name AS service_name, c.description, c.base_price, c.duration_minutes, c.rating_avg, c.reviews
     FROM fks_categories a
    INNER JOIN fks_categories b ON (a.category_id = b.parent_id)
    INNER JOIN fks_services c ON (b.category_id = c.category_id)
    ORDER BY a.parent_id, b.category_id, c.service_id
    WHERE a.category_id = 1

   ========================================================================= */

const CATEGORY_DATA = [
  {
    "categoryId": "salon-makeup",
    "name": "Salon & Makeup",
    "icon": "scissors",
    "image": "https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?w=800&q=80&auto=format&fit=crop",
    "tagLine": "Professional grooming and beauty services at home.",
    "subCategories": [
      {
        "categoryId": "womens-salon",
        "name": "Women's Salon",
        "image": "https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?w=800&q=80&auto=format&fit=crop",
        "services": [
          {
            "serviceId": "facial-fruit-glow",
            "name": "Fruit Facial Glow",
            "price": 799,
            "currency": "₹",
            "duration": "60 mins",
            "durationMinutes": 60,
            "rating": 4.8,
            "reviews": 2140,
            "description": "A refreshing fruit-based facial that brightens and hydrates tired skin.",
            "isPopular": true
          },
          {
            "serviceId": "hair-spa-care",
            "name": "Hair Spa & Care",
            "price": 899,
            "currency": "₹",
            "duration": "75 mins",
            "durationMinutes": 75,
            "rating": 4.7,
            "reviews": 1560,
            "description": "A deep-conditioning hair spa that repairs damage and restores natural shine."
          },
          {
            "serviceId": "arms-legs-waxing",
            "name": "Full Arms & Legs Waxing",
            "price": 599,
            "currency": "₹",
            "duration": "45 mins",
            "durationMinutes": 45,
            "rating": 4.6,
            "reviews": 3200,
            "description": "Smooth, salon-grade waxing for arms and legs using a gentle wax."
          },
          {
            "serviceId": "threading-brows-lip",
            "name": "Threading (Eyebrows + Upper Lip)",
            "price": 149,
            "currency": "₹",
            "duration": "20 mins",
            "durationMinutes": 20,
            "rating": 4.5,
            "reviews": 4100,
            "description": "Quick, precise threading for perfectly shaped brows and upper lip."
          },
          {
            "serviceId": "manicure-pedicure",
            "name": "Manicure & Pedicure",
            "price": 649,
            "currency": "₹",
            "duration": "60 mins",
            "durationMinutes": 60,
            "rating": 4.6,
            "reviews": 2450,
            "description": "A classic mani-pedi that leaves hands and feet soft, neat and polished."
          },
          {
            "serviceId": "hair-colour-women",
            "name": "Global Hair Colour",
            "price": 1299,
            "currency": "₹",
            "duration": "90 mins",
            "durationMinutes": 90,
            "rating": 4.5,
            "reviews": 870,
            "description": "Ammonia-friendly global colour application for full, even coverage."
          }
        ]
      },
      {
        "categoryId": "mens-salon",
        "name": "Men's Salon",
        "image": "https://images.unsplash.com/photo-1647140655214-e4a2d914971f?w=800&q=80&auto=format&fit=crop",
        "services": [
          {
            "serviceId": "haircut-styling",
            "name": "Haircut & Styling",
            "price": 299,
            "currency": "₹",
            "duration": "30 mins",
            "durationMinutes": 30,
            "rating": 4.7,
            "reviews": 5200,
            "description": "A precision haircut and styling from an experienced men's stylist.",
            "isPopular": true
          },
          {
            "serviceId": "beard-shape-trim",
            "name": "Beard Shape-up & Trim",
            "price": 199,
            "currency": "₹",
            "duration": "20 mins",
            "durationMinutes": 20,
            "rating": 4.6,
            "reviews": 4700,
            "description": "Sharp beard shaping and trim to keep your look fresh."
          },
          {
            "serviceId": "head-shoulder-massage",
            "name": "Head & Shoulder Massage",
            "price": 399,
            "currency": "₹",
            "duration": "30 mins",
            "durationMinutes": 30,
            "rating": 4.8,
            "reviews": 2300,
            "description": "A relaxing head and shoulder massage to relieve stress and tension."
          },
          {
            "serviceId": "mens-facial",
            "name": "De-Tan Facial for Men",
            "price": 549,
            "currency": "₹",
            "duration": "45 mins",
            "durationMinutes": 45,
            "rating": 4.5,
            "reviews": 1340,
            "description": "A de-tan facial that clears dullness and refreshes sun-exposed skin."
          },
          {
            "serviceId": "mens-hair-colour",
            "name": "Beard & Hair Colour",
            "price": 349,
            "currency": "₹",
            "duration": "30 mins",
            "durationMinutes": 30,
            "rating": 4.4,
            "reviews": 980,
            "description": "Natural-looking colour touch-up for greying hair and beard."
          }
        ]
      },
      {
        "categoryId": "bridal-party-makeup",
        "name": "Bridal & Party Makeup",
        "image": "https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?w=800&q=80&auto=format&fit=crop",
        "services": [
          {
            "serviceId": "party-makeup",
            "name": "Party Makeup",
            "price": 1499,
            "currency": "₹",
            "duration": "90 mins",
            "durationMinutes": 90,
            "rating": 4.9,
            "reviews": 860,
            "description": "Camera-ready party makeup tailored to your outfit and occasion.",
            "isPopular": true
          },
          {
            "serviceId": "bridal-makeup-hd",
            "name": "Bridal Makeup (HD)",
            "price": 6999,
            "currency": "₹",
            "duration": "150 mins",
            "durationMinutes": 150,
            "rating": 4.9,
            "reviews": 410,
            "description": "Long-lasting HD bridal makeup with draping and hairstyling included."
          },
          {
            "serviceId": "nail-art-manicure",
            "name": "Nail Art & Manicure",
            "price": 499,
            "currency": "₹",
            "duration": "40 mins",
            "durationMinutes": 40,
            "rating": 4.6,
            "reviews": 1980,
            "description": "A gel manicure with custom nail art finished by a trained nail artist."
          },
          {
            "serviceId": "engagement-makeup",
            "name": "Engagement Makeup",
            "price": 2999,
            "currency": "₹",
            "duration": "100 mins",
            "durationMinutes": 100,
            "rating": 4.8,
            "reviews": 320,
            "description": "Soft-glam engagement makeup designed to photograph beautifully."
          }
        ]
      }
    ]
  },
  {
    "categoryId": "cleaning-pest-control",
    "name": "Cleaning & Pest Control",
    "icon": "broom",
    "image": "https://images.unsplash.com/photo-1647381518264-97ff1835026f?w=800&q=80&auto=format&fit=crop",
    "tagLine": "Deep cleaning and pest treatments that actually last.",
    "subCategories": [
      {
        "categoryId": "home-cleaning",
        "name": "Home Cleaning",
        "image": "https://images.unsplash.com/photo-1647381518264-97ff1835026f?w=800&q=80&auto=format&fit=crop",
        "services": [
          {
            "serviceId": "full-home-deep-cleaning",
            "name": "Full Home Deep Cleaning",
            "price": 3499,
            "currency": "₹",
            "duration": "4 hrs",
            "durationMinutes": 240,
            "rating": 4.8,
            "reviews": 6200,
            "description": "A comprehensive deep clean covering every room, kitchen and bathroom.",
            "isPopular": true
          },
          {
            "serviceId": "kitchen-deep-cleaning",
            "name": "Kitchen Deep Cleaning",
            "price": 899,
            "currency": "₹",
            "duration": "90 mins",
            "durationMinutes": 90,
            "rating": 4.7,
            "reviews": 3100,
            "description": "Degreasing and sanitising of chimney, hob, cabinets and countertops."
          },
          {
            "serviceId": "bathroom-deep-cleaning",
            "name": "Bathroom Deep Cleaning",
            "price": 499,
            "currency": "₹",
            "duration": "60 mins",
            "durationMinutes": 60,
            "rating": 4.6,
            "reviews": 4400,
            "description": "Descaling and disinfecting tiles, fittings and fixtures until spotless."
          },
          {
            "serviceId": "sofa-carpet-shampooing",
            "name": "Sofa & Carpet Shampooing",
            "price": 799,
            "currency": "₹",
            "duration": "75 mins",
            "durationMinutes": 75,
            "rating": 4.5,
            "reviews": 1870,
            "description": "A machine shampoo wash to lift dirt and stains from sofas and carpets."
          },
          {
            "serviceId": "balcony-cleaning",
            "name": "Balcony & Grille Cleaning",
            "price": 399,
            "currency": "₹",
            "duration": "40 mins",
            "durationMinutes": 40,
            "rating": 4.4,
            "reviews": 760,
            "description": "Scrubbing and de-staining of balcony floors, grilles and railings."
          },
          {
            "serviceId": "move-in-cleaning",
            "name": "Move-in / Move-out Cleaning",
            "price": 2799,
            "currency": "₹",
            "duration": "3 hrs",
            "durationMinutes": 180,
            "rating": 4.7,
            "reviews": 1120,
            "description": "A thorough top-to-bottom clean to prep a home before or after moving."
          }
        ]
      },
      {
        "categoryId": "pest-control",
        "name": "Pest Control",
        "image": "https://images.unsplash.com/photo-1647381518264-97ff1835026f?w=800&q=80&auto=format&fit=crop",
        "services": [
          {
            "serviceId": "general-pest-control",
            "name": "General Pest Control",
            "price": 999,
            "currency": "₹",
            "duration": "60 mins",
            "durationMinutes": 60,
            "rating": 4.6,
            "reviews": 2800,
            "description": "An odourless spray treatment that keeps common household pests away.",
            "isPopular": true
          },
          {
            "serviceId": "cockroach-control",
            "name": "Cockroach Control",
            "price": 699,
            "currency": "₹",
            "duration": "45 mins",
            "durationMinutes": 45,
            "rating": 4.5,
            "reviews": 2100,
            "description": "A gel-based treatment that targets cockroaches at the source."
          },
          {
            "serviceId": "termite-control",
            "name": "Termite Control",
            "price": 2499,
            "currency": "₹",
            "duration": "2 hrs",
            "durationMinutes": 120,
            "rating": 4.7,
            "reviews": 940,
            "description": "An anti-termite treatment with long-lasting protection for wood and walls."
          },
          {
            "serviceId": "mosquito-fogging",
            "name": "Mosquito Fogging",
            "price": 599,
            "currency": "₹",
            "duration": "30 mins",
            "durationMinutes": 30,
            "rating": 4.4,
            "reviews": 1330,
            "description": "A fogging treatment that clears mosquito breeding spots indoors and out."
          },
          {
            "serviceId": "bed-bug-treatment",
            "name": "Bed Bug Treatment",
            "price": 1299,
            "currency": "₹",
            "duration": "90 mins",
            "durationMinutes": 90,
            "rating": 4.5,
            "reviews": 640,
            "description": "A targeted treatment that eliminates bed bugs from mattresses and furniture."
          },
          {
            "serviceId": "rodent-control",
            "name": "Rodent Control",
            "price": 899,
            "currency": "₹",
            "duration": "50 mins",
            "durationMinutes": 50,
            "rating": 4.4,
            "reviews": 510,
            "description": "Safe trapping and sealing to keep rodents out for good."
          }
        ]
      },
      {
        "categoryId": "office-cleaning",
        "name": "Office Cleaning",
        "image": "https://images.unsplash.com/photo-1647381518264-97ff1835026f?w=800&q=80&auto=format&fit=crop",
        "services": [
          {
            "serviceId": "office-deep-cleaning",
            "name": "Office Deep Cleaning",
            "price": 4999,
            "currency": "₹",
            "duration": "5 hrs",
            "durationMinutes": 300,
            "rating": 4.6,
            "reviews": 380,
            "description": "A full deep clean for workstations, common areas and pantries."
          },
          {
            "serviceId": "carpet-upholstery-office",
            "name": "Carpet & Upholstery Cleaning",
            "price": 1899,
            "currency": "₹",
            "duration": "2 hrs",
            "durationMinutes": 120,
            "rating": 4.5,
            "reviews": 210,
            "description": "Machine cleaning for office carpets, chairs and fabric partitions."
          },
          {
            "serviceId": "office-sanitization",
            "name": "Sanitization Service",
            "price": 2499,
            "currency": "₹",
            "duration": "90 mins",
            "durationMinutes": 90,
            "rating": 4.6,
            "reviews": 300,
            "description": "Disinfectant fogging across surfaces, desks and high-touch points."
          }
        ]
      }
    ]
  },
  {
    "categoryId": "appliance-repair",
    "name": "Appliance Repair",
    "icon": "wrench",
    "image": "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800&q=80&auto=format&fit=crop",
    "tagLine": "Fast, reliable repairs for the appliances you rely on daily.",
    "subCategories": [
      {
        "categoryId": "ac-service-repair",
        "name": "AC Service & Repair",
        "image": "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800&q=80&auto=format&fit=crop",
        "services": [
          {
            "serviceId": "ac-general-service",
            "name": "AC General Service",
            "price": 549,
            "currency": "₹",
            "duration": "45 mins",
            "durationMinutes": 45,
            "rating": 4.7,
            "reviews": 7100,
            "description": "A foam-jet cleaning that restores cooling efficiency and airflow.",
            "isPopular": true
          },
          {
            "serviceId": "ac-repair-visit",
            "name": "AC Repair Visit",
            "price": 299,
            "currency": "₹",
            "duration": "30 mins",
            "durationMinutes": 30,
            "rating": 4.5,
            "reviews": 3900,
            "description": "A diagnostic visit to identify and fix cooling or noise issues."
          },
          {
            "serviceId": "ac-gas-refill",
            "name": "AC Gas Refill",
            "price": 2199,
            "currency": "₹",
            "duration": "90 mins",
            "durationMinutes": 90,
            "rating": 4.6,
            "reviews": 1200,
            "description": "A refrigerant top-up for ACs that have lost cooling performance."
          },
          {
            "serviceId": "split-ac-installation",
            "name": "Split AC Installation",
            "price": 1499,
            "currency": "₹",
            "duration": "2 hrs",
            "durationMinutes": 120,
            "rating": 4.6,
            "reviews": 860,
            "description": "Professional mounting and installation of a new split AC unit."
          },
          {
            "serviceId": "window-ac-installation",
            "name": "Window AC Installation",
            "price": 999,
            "currency": "₹",
            "duration": "90 mins",
            "durationMinutes": 90,
            "rating": 4.5,
            "reviews": 540,
            "description": "Secure fitting and sealing for a new window AC unit."
          }
        ]
      },
      {
        "categoryId": "kitchen-appliances",
        "name": "Kitchen & Home Appliances",
        "image": "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800&q=80&auto=format&fit=crop",
        "services": [
          {
            "serviceId": "refrigerator-repair",
            "name": "Refrigerator Repair",
            "price": 399,
            "currency": "₹",
            "duration": "45 mins",
            "durationMinutes": 45,
            "rating": 4.5,
            "reviews": 2600,
            "description": "A diagnostic and repair visit for cooling, noise or leakage issues."
          },
          {
            "serviceId": "washing-machine-repair",
            "name": "Washing Machine Repair",
            "price": 399,
            "currency": "₹",
            "duration": "45 mins",
            "durationMinutes": 45,
            "rating": 4.5,
            "reviews": 3300,
            "description": "Troubleshooting and repair for drainage, spin or drum issues.",
            "isPopular": true
          },
          {
            "serviceId": "microwave-repair",
            "name": "Microwave Repair",
            "price": 349,
            "currency": "₹",
            "duration": "30 mins",
            "durationMinutes": 30,
            "rating": 4.4,
            "reviews": 1150,
            "description": "A repair visit for heating, sparking or control panel problems."
          },
          {
            "serviceId": "water-purifier-service",
            "name": "Water Purifier Service",
            "price": 449,
            "currency": "₹",
            "duration": "40 mins",
            "durationMinutes": 40,
            "rating": 4.6,
            "reviews": 1980,
            "description": "A filter check and service to keep your RO purifier running safely."
          },
          {
            "serviceId": "chimney-repair-cleaning",
            "name": "Chimney Repair & Cleaning",
            "price": 599,
            "currency": "₹",
            "duration": "50 mins",
            "durationMinutes": 50,
            "rating": 4.5,
            "reviews": 890,
            "description": "Degreasing filters and checking suction for a smoke-free kitchen."
          },
          {
            "serviceId": "geyser-repair",
            "name": "Geyser Repair & Service",
            "price": 449,
            "currency": "₹",
            "duration": "40 mins",
            "durationMinutes": 40,
            "rating": 4.4,
            "reviews": 760,
            "description": "A safety check and repair for heating elements and thermostats."
          }
        ]
      },
      {
        "categoryId": "electronics-repair",
        "name": "Electronics Repair",
        "image": "https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=800&q=80&auto=format&fit=crop",
        "services": [
          {
            "serviceId": "tv-repair",
            "name": "TV Repair",
            "price": 449,
            "currency": "₹",
            "duration": "45 mins",
            "durationMinutes": 45,
            "rating": 4.4,
            "reviews": 720,
            "description": "A diagnostic visit for display, sound or power issues on any TV."
          },
          {
            "serviceId": "laptop-repair",
            "name": "Laptop Repair",
            "price": 599,
            "currency": "₹",
            "duration": "60 mins",
            "durationMinutes": 60,
            "rating": 4.3,
            "reviews": 480,
            "description": "Hardware and software troubleshooting for slow or malfunctioning laptops."
          },
          {
            "serviceId": "inverter-battery-repair",
            "name": "Inverter & Battery Repair",
            "price": 499,
            "currency": "₹",
            "duration": "45 mins",
            "durationMinutes": 45,
            "rating": 4.4,
            "reviews": 390,
            "description": "Testing and repair to keep your home inverter backup reliable."
          }
        ]
      }
    ]
  },
  {
    "categoryId": "electrician-plumbing-carpentry",
    "name": "Electrician, Plumbing & Carpentry",
    "icon": "bolt",
    "image": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80&auto=format&fit=crop",
    "tagLine": "Trusted hands for wiring, leaks and everyday fixes.",
    "subCategories": [
      {
        "categoryId": "electrician",
        "name": "Electrician",
        "image": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80&auto=format&fit=crop",
        "services": [
          {
            "serviceId": "switch-socket-repair",
            "name": "Switch & Socket Repair",
            "price": 149,
            "currency": "₹",
            "duration": "20 mins",
            "durationMinutes": 20,
            "rating": 4.6,
            "reviews": 3400,
            "description": "Fix or replace faulty switches and sockets safely.",
            "isPopular": true
          },
          {
            "serviceId": "ceiling-fan-installation",
            "name": "Ceiling Fan Installation",
            "price": 249,
            "currency": "₹",
            "duration": "30 mins",
            "durationMinutes": 30,
            "rating": 4.6,
            "reviews": 2700,
            "description": "Secure mounting and wiring of a new ceiling fan."
          },
          {
            "serviceId": "house-wiring-inspection",
            "name": "House Wiring Inspection",
            "price": 499,
            "currency": "₹",
            "duration": "60 mins",
            "durationMinutes": 60,
            "rating": 4.5,
            "reviews": 980,
            "description": "A full electrical safety check to catch wiring issues early."
          },
          {
            "serviceId": "mcb-fuse-repair",
            "name": "MCB & Fuse Repair",
            "price": 299,
            "currency": "₹",
            "duration": "30 mins",
            "durationMinutes": 30,
            "rating": 4.5,
            "reviews": 1340,
            "description": "Diagnosis and repair of tripping MCBs or blown fuses."
          },
          {
            "serviceId": "inverter-installation",
            "name": "Inverter Installation",
            "price": 799,
            "currency": "₹",
            "duration": "75 mins",
            "durationMinutes": 75,
            "rating": 4.5,
            "reviews": 610,
            "description": "Wiring and setup for a new home inverter and battery backup."
          },
          {
            "serviceId": "cctv-doorbell-install",
            "name": "CCTV / Video Doorbell Install",
            "price": 649,
            "currency": "₹",
            "duration": "60 mins",
            "durationMinutes": 60,
            "rating": 4.6,
            "reviews": 540,
            "description": "Mounting and wiring for a smart camera or video doorbell."
          }
        ]
      },
      {
        "categoryId": "plumbing",
        "name": "Plumbing",
        "image": "https://images.unsplash.com/photo-1676210134190-3f2c0d5cf58d?w=800&q=80&auto=format&fit=crop",
        "services": [
          {
            "serviceId": "tap-mixer-repair",
            "name": "Tap & Mixer Repair",
            "price": 149,
            "currency": "₹",
            "duration": "20 mins",
            "durationMinutes": 20,
            "rating": 4.6,
            "reviews": 3900,
            "description": "Fix leaking or jammed taps and mixers in the kitchen or bathroom.",
            "isPopular": true
          },
          {
            "serviceId": "pipe-leakage-repair",
            "name": "Pipe Leakage Repair",
            "price": 349,
            "currency": "₹",
            "duration": "40 mins",
            "durationMinutes": 40,
            "rating": 4.5,
            "reviews": 2200,
            "description": "Locate and seal pipe leaks before they cause water damage."
          },
          {
            "serviceId": "toilet-flush-repair",
            "name": "Toilet & Flush Repair",
            "price": 299,
            "currency": "₹",
            "duration": "35 mins",
            "durationMinutes": 35,
            "rating": 4.5,
            "reviews": 1870,
            "description": "Repair of flush tanks, jets or toilet seat fittings."
          },
          {
            "serviceId": "water-tank-cleaning",
            "name": "Water Tank Cleaning",
            "price": 599,
            "currency": "₹",
            "duration": "60 mins",
            "durationMinutes": 60,
            "rating": 4.4,
            "reviews": 990,
            "description": "Deep cleaning and disinfection of overhead or underground tanks."
          },
          {
            "serviceId": "water-heater-installation",
            "name": "Water Heater Installation",
            "price": 549,
            "currency": "₹",
            "duration": "60 mins",
            "durationMinutes": 60,
            "rating": 4.5,
            "reviews": 720,
            "description": "Safe mounting and plumbing connection for a new geyser."
          },
          {
            "serviceId": "drainage-cleaning",
            "name": "Drainage Cleaning",
            "price": 449,
            "currency": "₹",
            "duration": "45 mins",
            "durationMinutes": 45,
            "rating": 4.3,
            "reviews": 650,
            "description": "Clearing clogged drains to restore normal water flow."
          }
        ]
      },
      {
        "categoryId": "carpentry",
        "name": "Carpentry",
        "image": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80&auto=format&fit=crop",
        "services": [
          {
            "serviceId": "furniture-assembly",
            "name": "Furniture Assembly",
            "price": 349,
            "currency": "₹",
            "duration": "45 mins",
            "durationMinutes": 45,
            "rating": 4.6,
            "reviews": 1650,
            "description": "Assembly of flat-pack furniture like beds, wardrobes and desks."
          },
          {
            "serviceId": "door-lock-repair",
            "name": "Door & Lock Repair",
            "price": 299,
            "currency": "₹",
            "duration": "30 mins",
            "durationMinutes": 30,
            "rating": 4.5,
            "reviews": 1420,
            "description": "Fix sticking doors, loose hinges or faulty locks."
          },
          {
            "serviceId": "furniture-repair",
            "name": "Furniture Repair",
            "price": 399,
            "currency": "₹",
            "duration": "40 mins",
            "durationMinutes": 40,
            "rating": 4.4,
            "reviews": 870,
            "description": "Repair of wobbly, broken or damaged wooden furniture."
          },
          {
            "serviceId": "curtain-rod-installation",
            "name": "Curtain Rod Installation",
            "price": 249,
            "currency": "₹",
            "duration": "30 mins",
            "durationMinutes": 30,
            "rating": 4.5,
            "reviews": 610,
            "description": "Levelled mounting of curtain rods and brackets on any wall."
          },
          {
            "serviceId": "wall-shelf-installation",
            "name": "Wall Shelf Installation",
            "price": 299,
            "currency": "₹",
            "duration": "35 mins",
            "durationMinutes": 35,
            "rating": 4.4,
            "reviews": 480,
            "description": "Secure fitting of wall-mounted shelves and storage units."
          }
        ]
      }
    ]
  },
  {
    "categoryId": "painting-decor",
    "name": "Painting & Décor",
    "icon": "paint-roller",
    "image": "https://images.unsplash.com/photo-1693985120993-e9b203ce7631?w=800&q=80&auto=format&fit=crop",
    "tagLine": "Fresh coats and finishing touches, handled end to end.",
    "subCategories": [
      {
        "categoryId": "interior-painting",
        "name": "Interior Painting",
        "image": "https://images.unsplash.com/photo-1693985120993-e9b203ce7631?w=800&q=80&auto=format&fit=crop",
        "services": [
          {
            "serviceId": "single-room-painting",
            "name": "Single Room Painting",
            "price": 3999,
            "currency": "₹",
            "duration": "1 day",
            "durationMinutes": 480,
            "rating": 4.6,
            "reviews": 610,
            "description": "Two coats of premium emulsion for one room's walls and ceiling.",
            "isPopular": true
          },
          {
            "serviceId": "full-home-painting",
            "name": "Full Home Painting",
            "price": 24999,
            "currency": "₹",
            "duration": "4-5 days",
            "durationMinutes": 2400,
            "rating": 4.7,
            "reviews": 340,
            "description": "A complete interior painting package sized for 2-3 BHK homes."
          },
          {
            "serviceId": "accent-wall-texture",
            "name": "Accent Wall Texture Design",
            "price": 4999,
            "currency": "₹",
            "duration": "1 day",
            "durationMinutes": 480,
            "rating": 4.5,
            "reviews": 210,
            "description": "A textured finish applied to a feature wall for a design accent."
          },
          {
            "serviceId": "wood-polish",
            "name": "Wood Polish & Varnish",
            "price": 2499,
            "currency": "₹",
            "duration": "1 day",
            "durationMinutes": 480,
            "rating": 4.5,
            "reviews": 260,
            "description": "Refinishing for doors, furniture and wood trims to restore their shine."
          },
          {
            "serviceId": "wall-stencil-art",
            "name": "Wall Stencil Art",
            "price": 1999,
            "currency": "₹",
            "duration": "5 hrs",
            "durationMinutes": 300,
            "rating": 4.4,
            "reviews": 180,
            "description": "A custom stencil design hand-painted onto a wall of your choice."
          }
        ]
      },
      {
        "categoryId": "exterior-painting",
        "name": "Exterior Painting",
        "image": "https://images.unsplash.com/photo-1693985120993-e9b203ce7631?w=800&q=80&auto=format&fit=crop",
        "services": [
          {
            "serviceId": "exterior-wall-painting",
            "name": "Exterior Wall Painting",
            "price": 18999,
            "currency": "₹",
            "duration": "3-4 days",
            "durationMinutes": 2040,
            "rating": 4.6,
            "reviews": 260,
            "description": "A weatherproof exterior painting package for independent houses.",
            "isPopular": true
          },
          {
            "serviceId": "waterproofing-treatment",
            "name": "Waterproofing Treatment",
            "price": 5999,
            "currency": "₹",
            "duration": "1 day",
            "durationMinutes": 480,
            "rating": 4.7,
            "reviews": 430,
            "description": "Preventive waterproofing for terraces, walls and bathrooms."
          },
          {
            "serviceId": "metal-grill-painting",
            "name": "Metal Grill & Gate Painting",
            "price": 2999,
            "currency": "₹",
            "duration": "1 day",
            "durationMinutes": 480,
            "rating": 4.4,
            "reviews": 150,
            "description": "Anti-rust primer and enamel finish for grilles, gates and railings."
          }
        ]
      }
    ]
  }
];

// Optional CommonJS export so this data file can be reused/tested outside
// the browser (e.g. Node scripts, unit tests) without any changes.
if (typeof module !== "undefined" && module.exports) {
  module.exports = CATEGORY_DATA;
}
