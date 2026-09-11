/**
 * checkout.js — Full Checkout controller for Playnex.
 * Features:
 *   - Live & responsive form validation on input & blur
 *   - Error prevention: Input masking (Card, Expiry MM/YY, CVC, Phone)
 *   - Web Storage API: Auto-saves and restores draft inputs via sessionStorage
 *   - Dynamic Order Summary fetched from server cart
 *   - Server-side validation integration & error handling
 */
(function () {
  'use strict';

  const { api, showToast } = window.Playnex;
  const DRAFT_KEY = 'playnex_checkout_draft';

  const form = document.querySelector('.checkout-form');
  const submitBtn = document.querySelector('.checkout-form button[type="submit"]');
  const summaryLines = document.querySelector('.cart-summary');
  const headerCountEl = document.querySelector('.page-header__count');

  const getCurrentUser = () => {
    try {
      return window.Playnex && typeof window.Playnex.getCurrentUser === 'function'
        ? window.Playnex.getCurrentUser()
        : JSON.parse(localStorage.getItem('playnex_user') || 'null');
    } catch (e) {
      return null;
    }
  };

  const isLoggedIn = !!getCurrentUser();

  if (!isLoggedIn && form) {
    const notice = document.createElement('p');
    notice.className = 'auth-server-msg is-error';
    notice.style.marginBottom = '16px';
    notice.innerHTML = 'You are checking out as a guest. <a href="Login.html" class="text-link">Log in</a> to place an order.';
    form.insertBefore(notice, form.firstChild);
  }

  const fields = [
    'full-name',
    'phone',
    'address',
    'city',
    'postal-code',
    'country',
    'card-name',
    'card-number',
    'card-expiry',
    'card-cvc'
  ];

  let cartSubtotal = 0;
  let cartTotal = 0;
  const touched = new Set();

  function money(n) {
    return `$${Number(n).toFixed(2)}`;
  }

  // Luhn algorithm for client-side card validation
  function isValidLuhn(numberStr) {
    const digits = numberStr.replace(/\D/g, '');
    if (digits.length < 13 || digits.length > 19) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = digits.length - 1; i >= 0; i--) {
      let digit = parseInt(digits.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  // ==========================================
  // COUNTRY PROFILES
  // ==========================================
  // Per-country rules so the form checks the delivery details against the
  // country the buyer actually selected. Each entry carries:
  //   dial     — international dialling code (used by the phone check)
  //   national — regex the subscriber number (without country code) must match
  //   postal   — regex for the postal/zip code, or null when the country has none
  //   cityHint / postalHint / phoneHint — shown in the error messages
  //   cities   — well-known cities, used to spot details from another country
  const COUNTRY_PROFILES = {
    // --- Asia ---
    cn: { name: 'China', dial: '86', national: /^1[3-9]\d{9}$/, postal: /^\d{6}$/,
      cities: ['beijing', 'shanghai', 'guangzhou', 'shenzhen', 'chengdu', 'wuhan', 'xian', "xi'an", 'hangzhou', 'tianjin', 'nanjing'],
      phoneHint: 'a mainland China mobile number (11 digits, e.g. 138 0013 8000)', postalHint: '6 digits (e.g. 100000 for Beijing)' },
    hk: { name: 'Hong Kong', dial: '852', national: /^[2-9]\d{7}$/, postal: null,
      cities: ['hong kong', 'kowloon', 'tsuen wan', 'sha tin', 'central', 'tseung kwan o'],
      phoneHint: 'a Hong Kong number (8 digits, e.g. 5123 4567)', postalHint: 'no postal code required' },
    in: { name: 'India', dial: '91', national: /^[6-9]\d{9}$/, postal: /^\d{6}$/,
      cities: ['mumbai', 'delhi', 'new delhi', 'bengaluru', 'bangalore', 'hyderabad', 'chennai', 'kolkata', 'pune', 'ahmedabad', 'jaipur'],
      phoneHint: 'an Indian mobile number (10 digits starting 6-9, e.g. 98765 43210)', postalHint: '6 digits (e.g. 110001 for New Delhi)' },
    id: { name: 'Indonesia', dial: '62', national: /^8\d{7,11}$/, postal: /^\d{5}$/,
      cities: ['jakarta', 'surabaya', 'bandung', 'medan', 'semarang', 'makassar', 'denpasar', 'bali', 'yogyakarta'],
      phoneHint: 'an Indonesian mobile number (e.g. 812 3456 7890)', postalHint: '5 digits (e.g. 10110 for Jakarta)' },
    jp: { name: 'Japan', dial: '81', national: /^[789]0\d{8}$/, postal: /^\d{3}-?\d{4}$/,
      cities: ['tokyo', 'osaka', 'kyoto', 'yokohama', 'nagoya', 'sapporo', 'fukuoka', 'kobe', 'sendai'],
      phoneHint: 'a Japanese mobile number (e.g. 090 1234 5678)', postalHint: '7 digits (e.g. 100-0001 for Tokyo)' },
    my: { name: 'Malaysia', dial: '60', national: /^1\d{8,9}$/, postal: /^\d{5}$/,
      cities: ['kuala lumpur', 'penang', 'george town', 'johor bahru', 'ipoh', 'shah alam', 'kota kinabalu', 'kuching', 'malacca'],
      phoneHint: 'a Malaysian mobile number (e.g. 12 345 6789)', postalHint: '5 digits (e.g. 50000 for Kuala Lumpur)' },
    ph: { name: 'Philippines', dial: '63', national: /^9\d{9}$/, postal: /^\d{4}$/,
      cities: ['manila', 'quezon city', 'cebu', 'davao', 'makati', 'taguig', 'pasig', 'baguio', 'ilo'],
      phoneHint: 'a Philippine mobile number (10 digits starting 9, e.g. 917 123 4567)', postalHint: '4 digits (e.g. 1000 for Manila)' },
    sa: { name: 'Saudi Arabia', dial: '966', national: /^5\d{8}$/, postal: /^\d{5}$/,
      cities: ['riyadh', 'jeddah', 'mecca', 'medina', 'dammam', 'khobar', 'taif'],
      phoneHint: 'a Saudi mobile number (e.g. 50 123 4567)', postalHint: '5 digits (e.g. 11564 for Riyadh)' },
    sg: { name: 'Singapore', dial: '65', national: /^[89]\d{7}$/, postal: /^\d{6}$/,
      cities: ['singapore', 'jurong', 'woodlands', 'tampines', 'bedok', 'serangoon'],
      phoneHint: 'a Singapore number (8 digits starting 8 or 9, e.g. 8123 4567)', postalHint: '6 digits (e.g. 018956)' },
    kr: { name: 'South Korea', dial: '82', national: /^1\d{8,9}$/, postal: /^\d{5}$/,
      cities: ['seoul', 'busan', 'incheon', 'daegu', 'daejeon', 'gwangju', 'suwon'],
      phoneHint: 'a South Korean mobile number (e.g. 10 1234 5678)', postalHint: '5 digits (e.g. 03051 for Seoul)' },
    tw: { name: 'Taiwan', dial: '886', national: /^9\d{8}$/, postal: /^\d{3}$/,
      cities: ['taipei', 'kaohsiung', 'taichung', 'tainan', 'hsinchu', 'keelung'],
      phoneHint: 'a Taiwan mobile number (9 digits starting 9, e.g. 912 345 678)', postalHint: '3 digits (e.g. 100 for Taipei)' },
    th: { name: 'Thailand', dial: '66', national: /^[689]\d{8}$/, postal: /^\d{5}$/,
      cities: ['bangkok', 'chiang mai', 'phuket', 'pattaya', 'khon kaen', 'hat yai'],
      phoneHint: 'a Thai mobile number (e.g. 81 234 5678)', postalHint: '5 digits (e.g. 10110 for Bangkok)' },
    ae: { name: 'United Arab Emirates', dial: '971', national: /^5\d{8}$/, postal: null,
      cities: ['dubai', 'abu dhabi', 'sharjah', 'ajman', 'al ain', 'ras al khaimah'],
      phoneHint: 'a UAE mobile number (e.g. 50 123 4567)', postalHint: 'no postal code required' },
    vn: { name: 'Vietnam', dial: '84', national: /^[35789]\d{8}$|^2\d{9}$/, postal: /^\d{5,6}$/,
      cities: ['ho chi minh', 'saigon', 'hanoi', 'ha noi', 'da nang', 'danang', 'hai phong', 'can tho', 'hue', 'nha trang', 'vung tau', 'bien hoa'],
      phoneHint: 'a Vietnam phone number (e.g. 090 123 4567 or +84901234567)', postalHint: '5–6 digits (e.g. 700000 for HCMC, 100000 for Hanoi)' },

    // --- Europe ---
    at: { name: 'Austria', dial: '43', national: /^6\d{8,12}$/, postal: /^\d{4}$/, cities: ['vienna', 'graz', 'linz', 'salzburg', 'innsbruck'],
      phoneHint: 'an Austrian mobile number (e.g. 664 123456)', postalHint: '4 digits (e.g. 1010 for Vienna)' },
    be: { name: 'Belgium', dial: '32', national: /^4\d{7,8}$/, postal: /^\d{4}$/, cities: ['brussels', 'antwerp', 'ghent', 'bruges', 'liege', 'charleroi'],
      phoneHint: 'a Belgian mobile number (e.g. 470 12 34 56)', postalHint: '4 digits (e.g. 1000 for Brussels)' },
    cz: { name: 'Czech Republic', dial: '420', national: /^[67]\d{8}$/, postal: /^\d{3}\s?\d{2}$/, cities: ['prague', 'brno', 'ostrava', 'plzen'],
      phoneHint: 'a Czech mobile number (9 digits, e.g. 601 123 456)', postalHint: '5 digits (e.g. 110 00 for Prague)' },
    dk: { name: 'Denmark', dial: '45', national: /^\d{8}$/, postal: /^\d{4}$/, cities: ['copenhagen', 'aarhus', 'odense', 'aalborg'],
      phoneHint: 'a Danish number (8 digits, e.g. 20 12 34 56)', postalHint: '4 digits (e.g. 1000 for Copenhagen)' },
    fi: { name: 'Finland', dial: '358', national: /^4[0-9]\d{6,8}$/, postal: /^\d{5}$/, cities: ['helsinki', 'espoo', 'tampere', 'turku', 'oulu'],
      phoneHint: 'a Finnish mobile number (e.g. 40 123 4567)', postalHint: '5 digits (e.g. 00100 for Helsinki)' },
    fr: { name: 'France', dial: '33', national: /^[67]\d{8}$/, postal: /^\d{5}$/, cities: ['paris', 'marseille', 'lyon', 'toulouse', 'nice', 'nantes', 'bordeaux', 'lille'],
      phoneHint: 'a French mobile number (9 digits starting 6 or 7, e.g. 6 12 34 56 78)', postalHint: '5 digits (e.g. 75001 for Paris)' },
    de: { name: 'Germany', dial: '49', national: /^1[5-7]\d{8,9}$/, postal: /^\d{5}$/, cities: ['berlin', 'munich', 'hamburg', 'frankfurt', 'cologne', 'stuttgart', 'dusseldorf', 'dresden'],
      phoneHint: 'a German mobile number (e.g. 151 23456789)', postalHint: '5 digits (e.g. 10115 for Berlin)' },
    gr: { name: 'Greece', dial: '30', national: /^69\d{8}$/, postal: /^\d{3}\s?\d{2}$/, cities: ['athens', 'thessaloniki', 'patras', 'heraklion'],
      phoneHint: 'a Greek mobile number (10 digits starting 69, e.g. 691 234 5678)', postalHint: '5 digits (e.g. 105 58 for Athens)' },
    ie: { name: 'Ireland', dial: '353', national: /^8[3-9]\d{7}$/, postal: /^[A-Z]\d{2}\s?[A-Z0-9]{4}$/i, cities: ['dublin', 'cork', 'galway', 'limerick', 'waterford'],
      phoneHint: 'an Irish mobile number (e.g. 85 123 4567)', postalHint: 'Eircode format (e.g. D02 X285 for Dublin)' },
    it: { name: 'Italy', dial: '39', national: /^3\d{8,9}$/, postal: /^\d{5}$/, cities: ['rome', 'milan', 'naples', 'turin', 'florence', 'venice', 'bologna', 'palermo'],
      phoneHint: 'an Italian mobile number (e.g. 312 345 6789)', postalHint: '5 digits (e.g. 00100 for Rome)' },
    nl: { name: 'Netherlands', dial: '31', national: /^6\d{8}$/, postal: /^\d{4}\s?[A-Z]{2}$/i, cities: ['amsterdam', 'rotterdam', 'the hague', 'utrecht', 'eindhoven', 'groningen'],
      phoneHint: 'a Dutch mobile number (e.g. 6 12345678)', postalHint: '4 digits + 2 letters (e.g. 1011 AB)' },
    no: { name: 'Norway', dial: '47', national: /^[49]\d{7}$/, postal: /^\d{4}$/, cities: ['oslo', 'bergen', 'trondheim', 'stavanger', 'tromso'],
      phoneHint: 'a Norwegian number (8 digits, e.g. 412 34 567)', postalHint: '4 digits (e.g. 0150 for Oslo)' },
    pl: { name: 'Poland', dial: '48', national: /^\d{9}$/, postal: /^\d{2}-?\d{3}$/, cities: ['warsaw', 'krakow', 'lodz', 'wroclaw', 'poznan', 'gdansk'],
      phoneHint: 'a Polish number (9 digits, e.g. 512 345 678)', postalHint: '5 digits (e.g. 00-001 for Warsaw)' },
    pt: { name: 'Portugal', dial: '351', national: /^9[1236]\d{7}$/, postal: /^\d{4}-?\d{3}$/, cities: ['lisbon', 'porto', 'braga', 'coimbra', 'faro'],
      phoneHint: 'a Portuguese mobile number (9 digits starting 9, e.g. 912 345 678)', postalHint: '7 digits (e.g. 1000-001 for Lisbon)' },
    es: { name: 'Spain', dial: '34', national: /^[67]\d{8}$/, postal: /^\d{5}$/, cities: ['madrid', 'barcelona', 'valencia', 'seville', 'zaragoza', 'malaga', 'bilbao'],
      phoneHint: 'a Spanish mobile number (9 digits starting 6 or 7, e.g. 612 345 678)', postalHint: '5 digits (e.g. 28001 for Madrid)' },
    se: { name: 'Sweden', dial: '46', national: /^7[02369]\d{7}$/, postal: /^\d{3}\s?\d{2}$/, cities: ['stockholm', 'gothenburg', 'malmo', 'uppsala', 'vasteras'],
      phoneHint: 'a Swedish mobile number (e.g. 70 123 45 67)', postalHint: '5 digits (e.g. 111 22 for Stockholm)' },
    ch: { name: 'Switzerland', dial: '41', national: /^7[5-9]\d{7}$/, postal: /^\d{4}$/, cities: ['zurich', 'geneva', 'basel', 'bern', 'lausanne'],
      phoneHint: 'a Swiss mobile number (e.g. 78 123 45 67)', postalHint: '4 digits (e.g. 8001 for Zurich)' },
    gb: { name: 'United Kingdom', dial: '44', national: /^7\d{9}$/, postal: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
      cities: ['london', 'manchester', 'birmingham', 'liverpool', 'leeds', 'glasgow', 'edinburgh', 'bristol', 'cardiff', 'belfast'],
      phoneHint: 'a UK mobile number (11 digits starting 07, e.g. 7400 123456)', postalHint: 'UK postcode format (e.g. SW1A 1AA)' },

    // --- Other regions ---
    au: { name: 'Australia', dial: '61', national: /^4\d{8}$/, postal: /^\d{4}$/, cities: ['sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'canberra', 'gold coast'],
      phoneHint: 'an Australian mobile number (e.g. 412 345 678)', postalHint: '4 digits (e.g. 2000 for Sydney)' },
    br: { name: 'Brazil', dial: '55', national: /^\d{10,11}$/, postal: /^\d{5}-?\d{3}$/, cities: ['sao paulo', 'rio de janeiro', 'brasilia', 'salvador', 'fortaleza', 'belo horizonte', 'curitiba'],
      phoneHint: 'a Brazilian number with area code (e.g. 11 91234 5678)', postalHint: '8 digits (e.g. 01310-100 for Sao Paulo)' },
    ca: { name: 'Canada', dial: '1', national: /^\d{10}$/, postal: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
      cities: ['toronto', 'vancouver', 'montreal', 'calgary', 'ottawa', 'edmonton', 'quebec', 'winnipeg'],
      phoneHint: 'a Canadian number (10 digits, e.g. 416 555 0123)', postalHint: 'Canadian format (e.g. M5V 3L9)' },
    nz: { name: 'New Zealand', dial: '64', national: /^2\d{7,9}$/, postal: /^\d{4}$/, cities: ['auckland', 'wellington', 'christchurch', 'hamilton', 'dunedin'],
      phoneHint: 'a New Zealand mobile number (e.g. 21 123 4567)', postalHint: '4 digits (e.g. 6011 for Wellington)' },
    us: { name: 'United States', dial: '1', national: /^\d{10}$/, postal: /^\d{5}(-\d{4})?$/,
      cities: ['new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 'san antonio', 'san diego', 'dallas', 'san francisco', 'seattle', 'boston', 'miami', 'atlanta'],
      phoneHint: 'a US number (10 digits, e.g. 415 555 0123)', postalHint: '5 digits or ZIP+4 (e.g. 10001 for New York)' }
  };

  // Convenience accessors. `selectedCountry` is '' until the buyer picks one.
  function getSelectedCountry() {
    const el = document.getElementById('country');
    return el ? el.value : '';
  }

  function countryProfile(code) {
    return COUNTRY_PROFILES[code || ''] || null;
  }

  function countryName(code) {
    const profile = countryProfile(code);
    return profile ? profile.name : 'the selected country';
  }

  // A cart is "physical" when it holds at least one hard good that must actually
  // be shipped; only then is the delivery address checked against the country.
  // Digital-only carts are location-independent and accept any country.
  let cartHasPhysical = false;

  // Does the typed city name a well-known city of some OTHER country?
  // Returns that country's code, or null when the city is unknown or belongs to
  // the selected country. Cross-country checking is skipped for digital-only
  // carts, which have no delivery address to be wrong about.
  function findForeignCityMatch(city) {
    if (!cartHasPhysical) return null;

    const selected = getSelectedCountry();
    if (!selected) return null;

    const needle = city.toLowerCase().trim();
    if (needle.length < 3) return null;

    // A city listed for the selected country is always fine.
    const own = countryProfile(selected);
    if (own && (own.cities || []).some(c => needle.includes(c) || c.includes(needle))) {
      return null;
    }

    for (const [code, profile] of Object.entries(COUNTRY_PROFILES)) {
      if (code === selected) continue;
      const hit = (profile.cities || []).some(c => {
        // Match whole words so "vienna" does not fire on "viennese", and short
        // names like "nice" do not fire on "venice".
        const escaped = c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, 'i').test(needle);
      });
      if (hit) return code;
    }
    return null;
  }

  // Validation rules. Delivery rules follow the selected country, so the same
  // field validates differently for a US or a Japanese address.
  const validators = {
    'full-name': (v) => {
      const clean = v.trim();
      if (clean.length < 2) return 'Please enter your full name.';
      if (!/^[a-zA-ZÀ-ỹ\s'.-]{2,100}$/.test(clean)) return 'Name must contain only letters and spaces.';
      return '';
    },
    'phone': (v) => {
      const clean = v.trim();

      // Digital-only orders have nothing to ship, so the number is not tied to
      // the delivery country and any reasonable format is accepted.
      if (!cartHasPhysical) {
        if (!clean) return 'Please enter your phone number.';
        return /^\+?[0-9][0-9\s().-]{6,19}$/.test(clean)
          ? ''
          : 'Please enter a valid phone number (7–15 digits, optionally with a country code).';
      }

      const code = getSelectedCountry();
      const profile = countryProfile(code);
      if (!clean) return 'Please enter your phone number.';

      // Strip spaces, dashes, dots and brackets, then remove the country code
      // (either +<dial> or a bare <dial> prefix) so the national part remains.
      let digits = clean.replace(/[\s().-]/g, '');
      const hadPlus = digits.startsWith('+');
      if (hadPlus) digits = digits.slice(1);

      if (profile) {
        const dial = profile.dial;
        if (hadPlus) {
          if (!digits.startsWith(dial)) {
            return `The phone number does not match ${profile.name}. Expected a number beginning +${dial}, e.g. ${profile.phoneHint}.`;
          }
          digits = digits.slice(dial.length);
        } else if (digits.startsWith('00' + dial)) {
          digits = digits.slice(2 + dial.length);
        } else if (digits.startsWith('0')) {
          // Domestic form: drop the single trunk zero.
          digits = digits.slice(1);
        }

        if (!/^\d+$/.test(digits)) {
          return `Phone number must contain digits only. Use ${profile.phoneHint}.`;
        }
        if (!profile.national.test(digits)) {
          return `This phone number does not look like a ${profile.name} number. Please enter ${profile.phoneHint}.`;
        }
        return '';
      }

      // No country chosen yet: accept any reasonable international number.
      const generic = /^\+?\d{7,15}$/.test(clean.replace(/[\s().-]/g, ''));
      return generic ? '' : 'Please enter a valid phone number (7–15 digits, optionally with a country code).';
    },
    'address': (v) => (v.trim().length >= 3 ? '' : 'Please enter your street address (e.g. 123 Le Van Viet Street).'),
    'city': (v) => {
      const clean = v.trim();
      if (clean.length < 2) return 'Please enter your city/province.';

      // Spot a city that belongs to a different country than the one selected.
      // Only enforced for shippable orders — see cartHasPhysical above.
      const wrong = findForeignCityMatch(clean);
      if (wrong) {
        return `"${clean}" is a city in ${countryName(wrong)}, but you selected ${countryName(getSelectedCountry())}. Please enter a city/region in ${countryName(getSelectedCountry())}, or change the country.`;
      }
      return '';
    },
    'postal-code': (v) => {
      const clean = v.trim();

      // Nothing is being shipped on a digital-only order, so no country's
      // postal format is enforced (the delivery block is hidden entirely).
      if (!cartHasPhysical) {
        if (!clean) return '';
        return /^[A-Z0-9][A-Z0-9\s-]{2,10}$/i.test(clean) ? '' : 'Enter a valid postal code.';
      }

      const code = getSelectedCountry();
      const profile = countryProfile(code);

      if (!profile) {
        // No country selected yet — defer to the general format.
        return /^[A-Z0-9][A-Z0-9\s-]{2,10}$/i.test(clean) ? '' : 'Enter a valid postal code.';
      }
      if (!clean) return `Please enter the postal code for ${profile.name} (${profile.postalHint}).`;
      if (!profile.postal) {
        // Some countries (e.g. Hong Kong, UAE) have no postal code system, so
        // anything the buyer types is acceptable — including nothing at all.
        return '';
      }
      if (!profile.postal.test(clean)) {
        return `This postal code does not match ${profile.name}. Expected ${profile.postalHint}.`;
      }
      return '';
    },
    'country': (v) => (v ? '' : 'Please select a delivery country.'),
    'card-name': (v) => {
      const clean = v.trim();
      if (clean.length < 2) return 'Enter the cardholder name (e.g. NGUYEN VAN A).';
      if (!/^[a-zA-ZÀ-ỹ\s]{2,100}$/.test(clean)) return 'Name must contain only letters and spaces.';
      return '';
    },
    'card-number': (v) => {
      const clean = v.replace(/\s+/g, '');
      if (clean.length < 15) return 'Card number must be at least 15 digits.';
      if (clean.length > 19) return 'Card number cannot exceed 19 digits.';
      if (!/^[0-9]{15,19}$/.test(clean)) return 'Card number must contain only numbers (15 to 19 digits).';
      if (!isValidLuhn(clean)) return 'Card number is invalid. Please check the digits and try again.';
      return '';
    },
    'card-expiry': (v) => {
      const clean = v.trim();
      const m = clean.match(/^(\d{1,2})\/(\d{2,4})$/);
      if (!m) return 'Enter expiry in MM/YY format.';
      const month = parseInt(m[1], 10);
      if (month < 1 || month > 12) return 'Invalid expiry month (01–12).';
      // A card is valid through the last day of its expiry month.
      const rawYear = parseInt(m[2], 10);
      const fullYear = rawYear < 100 ? 2000 + rawYear : rawYear;
      const expiryEnd = new Date(fullYear, month, 1); // first moment after the expiry month
      if (expiryEnd.getTime() <= Date.now()) return 'This card has expired. Please use a valid card.';
      return '';
    },
    'card-cvc': (v) => (/^[0-9]{2,6}$/.test(v.trim()) ? '' : 'Security code must be digits (e.g. 3 or 4 digits).')
  };

  function getOrCreateErrorElement(input) {
    let err = input.parentElement.querySelector('.form-group__error');
    if (!err) {
      err = document.createElement('span');
      err.className = 'form-group__error';
      err.setAttribute('role', 'alert');
      input.parentElement.appendChild(err);
    }
    return err;
  }

  function validateField(id) {
    const input = document.getElementById(id);
    if (!input) return true;

    const errorEl = getOrCreateErrorElement(input);
    const msg = validators[id] ? validators[id](input.value) : '';
    const isTouched = touched.has(id);

    if (isTouched && msg) {
      input.classList.add('is-invalid');
      input.classList.remove('is-valid');
      errorEl.textContent = msg;
      return false;
    } else if (isTouched && !msg && input.value.trim().length > 0) {
      input.classList.remove('is-invalid');
      input.classList.add('is-valid');
      errorEl.textContent = '';
      return true;
    } else {
      input.classList.remove('is-invalid');
      input.classList.remove('is-valid');
      errorEl.textContent = '';
      return msg === '';
    }
  }

  function checkFormValid() {
    return fields.every((id) => {
      const el = document.getElementById(id);
      return el && validators[id] && validators[id](el.value) === '';
    });
  }

  function updateSubmitState() {
    const isValid = checkFormValid();
    if (submitBtn) {
      submitBtn.disabled = !isValid;
      submitBtn.classList.toggle('is-disabled', !isValid);
    }
  }

  // --- Web Storage (sessionStorage draft) ---
  function saveDraft() {
    const draft = {};
    fields.forEach((id) => {
      const el = document.getElementById(id);
      if (el) draft[id] = el.value;
    });
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }

  function restoreDraft() {
    try {
      const raw = sessionStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      fields.forEach((id) => {
        const el = document.getElementById(id);
        if (el && draft[id] !== undefined && draft[id] !== '') {
          el.value = draft[id];
        }
      });
    } catch (e) {}
  }

  function clearDraft() {
    sessionStorage.removeItem(DRAFT_KEY);
  }

  // --- Error Prevention Input Masking ---
  const cardNameInput = document.getElementById('card-name');
  if (cardNameInput) {
    cardNameInput.addEventListener('input', (e) => {
      e.target.value = e.target.value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .replace(/[^a-zA-Z\s]/g, '')
        .toUpperCase();
    });
  }

  const cardNumberInput = document.getElementById('card-number');
  if (cardNumberInput) {
    cardNumberInput.addEventListener('input', (e) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 19);
      e.target.value = digits.replace(/(.{4})/g, '$1 ').trim();
    });
  }

  const cardExpiryInput = document.getElementById('card-expiry');
  if (cardExpiryInput) {
    cardExpiryInput.addEventListener('input', (e) => {
      let digits = e.target.value.replace(/\D/g, '').slice(0, 4);
      if (digits.length >= 3) {
        digits = `${digits.slice(0, 2)}/${digits.slice(2, 4)}`;
      }
      e.target.value = digits;
    });
  }

  const cardCvcInput = document.getElementById('card-cvc');
  if (cardCvcInput) {
    cardCvcInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    });
  }

  // ==========================================
  // AUTO-FILL PAYMENT DETAILS
  // ==========================================
  // Sample card data used to populate the payment block. The number is a
  // published test PAN that passes the Luhn check performed by the validator
  // and by the server, so the filled form is genuinely submittable.
  const SAMPLE_CARD = {
    number: '4242 4242 4242 4242',
    cvc: '123'
  };

  // "Name on card" must be letters and spaces only (the field is uppercased and
  // stripped of accents by its mask), so a name with a diacritic would be
  // rejected before it ever reached here.
  function sampleCardholderName() {
    const fullName = document.getElementById('full-name');
    const typed = fullName ? fullName.value.trim() : '';
    const source = typed || 'NGUYEN VAN A';
    return source
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z\s]/g, '')
      .trim()
      .toUpperCase() || 'NGUYEN VAN A';
  }

  // A card must still be valid on the last day of its expiry month, so pick a
  // date comfortably in the future rather than one that could be near-expired.
  function sampleExpiry(monthsAhead = 6) {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + monthsAhead, 1);
    const month = String(target.getMonth() + 1).padStart(2, '0');
    const year = String(target.getFullYear()).slice(-2);
    return `${month}/${year}`;
  }

  // Writes a value the way the user would have typed it, so the masking
  // listeners and the draft-saving logic see a normal input event.
  function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  const autofillBtn = document.getElementById('autofill-payment-btn');
  if (autofillBtn) {
    autofillBtn.addEventListener('click', () => {
      setFieldValue('card-name', sampleCardholderName());
      setFieldValue('card-number', SAMPLE_CARD.number);
      setFieldValue('card-expiry', sampleExpiry());
      setFieldValue('card-cvc', SAMPLE_CARD.cvc);

      showToast('Payment details filled with sample card data.', 'success');
      updateSubmitState();
      saveDraft();
    });
  }

  const phoneInput = document.getElementById('phone');
  if (phoneInput) {
    phoneInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9 +()-]/g, '');
    });
  }

  // Setup live validation triggers on fields
  fields.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;

    input.addEventListener('input', () => {
      touched.add(id);
      validateField(id);
      updateSubmitState();
      saveDraft();
    });

    input.addEventListener('blur', () => {
      touched.add(id);
      validateField(id);
      updateSubmitState();
    });
  });

  // Changing the country re-checks every delivery field, because the phone,
  // postal-code and city rules are all expressed in terms of that country.
  const countrySelect = document.getElementById('country');
  if (countrySelect) {
    countrySelect.addEventListener('change', () => {
      touched.add('country');
      // Fields the buyer has already interacted with are re-checked against the
      // new country; untouched ones stay quiet until they are filled in.
      ['phone', 'postal-code', 'city'].forEach((id) => {
        if (touched.has(id)) validateField(id);
      });
      validateField('country');
      updateSubmitState();
      saveDraft();
    });
  }

  // --- Load Cart Order Summary ---
  async function loadOrderSummary() {
    try {
      let data = await api('/api/cart');

      // Re-apply a saved promo code so the summary and 'Place order' button
      // reflect the same discounted total that the cart page showed.
      try {
        const savedPromo = JSON.parse(sessionStorage.getItem('playnex_cart_promo') || 'null');
        if (savedPromo && savedPromo.code) {
          const promoRes = await api('/api/cart/promo', {
            method: 'POST',
            body: { code: savedPromo.code }
          });
          if (promoRes && typeof promoRes.total === 'number') data = promoRes;
        }
      } catch (e) {
        // Promo is no longer valid server-side; fall back to the plain cart totals.
        try { sessionStorage.removeItem('playnex_cart_promo'); } catch (e2) {}
      }

      const items = data.items || [];

      if (items.length === 0) {
        showToast('Your cart is empty. Redirecting to store...', 'info');
        if (submitBtn) submitBtn.disabled = true;
        setTimeout(() => {
          window.location.href = 'shopping.html';
        }, 1500);
        return;
      }

      cartSubtotal = data.subtotal;
      cartTotal = data.total;
      if (data.discount) {
        try {
          sessionStorage.setItem('playnex_cart_promo', JSON.stringify({
            code: data.promoCode || '',
            discount: (data.discountPercent || 0) / 100
          }));
        } catch (e) {}
      }

      const hasPhysical = items.some(i => i.product && i.product.category === 'physical');
      // Publish this for the validators: cross-country delivery checks only
      // apply when something actually has to be shipped.
      cartHasPhysical = hasPhysical;
      const deliveryFieldset = form ? form.querySelector('fieldset') : null;
      if (deliveryFieldset && !hasPhysical) {
        deliveryFieldset.style.display = 'none';
      }

      if (headerCountEl) {
        headerCountEl.textContent = `${data.itemCount} items · ${money(data.total)}`;
      }

      if (summaryLines) {
        const itemRows = items.map(
          (i) => `<div class="cart-summary__row"><span>${i.product.title}${i.qty > 1 ? ` ×${i.qty}` : ''}</span><span>${money(i.product.price * i.qty)}</span></div>`
        ).join('');

        // The voucher row shows the amount taken off the subtotal, so the
        // deduction is visible rather than folded into the total. Only rendered
        // when a voucher actually reduced the order.
        const voucherRowHTML = data.discount
          ? `<div class="cart-summary__row cart-summary__row--discount">
               <span>Voucher</span>
               <span class="cart-summary__voucher-amount">-${money(data.discount)}</span>
             </div>`
          : '';

        summaryLines.innerHTML = `
          <h2>Order summary</h2>
          ${itemRows}
          <div class="cart-summary__row"><span>Subtotal</span><span>${money(data.subtotal)}</span></div>
          ${voucherRowHTML}
          <div class="cart-summary__row"><span>Shipping</span><span>${money(data.shipping)}</span></div>
          <div class="cart-summary__row"><span>Tax (8.3%)</span><span>${money(data.tax)}</span></div>
          <div class="cart-summary__row cart-summary__row--total"><span>Total</span><span>${money(data.total)}</span></div>
        `;
      }

      if (submitBtn) {
        submitBtn.textContent = `Place order — ${money(data.total)}`;
      }
    } catch (err) {
      console.error('Error loading checkout summary:', err);
    }
  }

  // --- Form Submission ---
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!isLoggedIn) {
        showToast('Please log in to place an order. <a href="Login.html" class="playnex-toast__link">Log In -&gt;</a>', 'error');
        setTimeout(() => { window.location.href = 'Login.html'; }, 2000);
        return;
      }

      // Mark all fields touched
      fields.forEach((id) => touched.add(id));
      const allValid = fields.map(validateField).every(Boolean);

      if (!allValid) {
        showToast('Please fix the highlighted errors before submitting.', 'error');
        updateSubmitState();
        return;
      }

      submitBtn.disabled = true;
      const originalText = submitBtn.textContent;
      submitBtn.textContent = 'Processing order...';

      const payload = {
        // Re-apply the promo code applied on the cart page so the server can
        // include the same discount in the order totals (code is re-validated
        // server-side; only the string is sent, never the discount amount).
        promoCode: (() => {
          try {
            const savedPromo = JSON.parse(sessionStorage.getItem('playnex_cart_promo') || 'null');
            return savedPromo && savedPromo.code ? String(savedPromo.code) : '';
          } catch (e) { return ''; }
        })(),
        delivery: {
          fullName: document.getElementById('full-name').value.trim(),
          phone: document.getElementById('phone').value.trim(),
          address: document.getElementById('address').value.trim(),
          city: document.getElementById('city').value.trim(),
          postalCode: document.getElementById('postal-code').value.trim(),
          country: document.getElementById('country').value
        },
        payment: {
          cardName: document.getElementById('card-name').value.trim(),
          cardNumber: document.getElementById('card-number').value.replace(/\s+/g, ''),
          expiry: document.getElementById('card-expiry').value.trim(),
          cvc: document.getElementById('card-cvc').value.trim()
        }
      };

      try {
        const res = await api('/api/checkout', {
          method: 'POST',
          body: payload
        });

        if (res && res.order) {
          try {
            sessionStorage.setItem('playnex_last_order', JSON.stringify(res.order));
            localStorage.setItem('playnex_last_order', JSON.stringify(res.order));
          } catch (e) {}
        }

        clearDraft();
        localStorage.removeItem('playnex_cart_cache');
        try { sessionStorage.removeItem('playnex_cart_promo'); } catch (e) {}
        showToast('Order confirmed successfully!', 'success');

        setTimeout(() => {
          const orderId = (res && res.order && res.order.id) ? res.order.id : '';
          window.location.href = orderId ? `confirmation.html?order=${encodeURIComponent(orderId)}` : 'confirmation.html';
        }, 500);
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;

        if (err.fields) {
          // Highlight server-side validation error fields
          Object.entries(err.fields).forEach(([fieldKey, errorMsg]) => {
            const inputId = fieldKey === 'fullName' ? 'full-name'
              : fieldKey === 'postalCode' ? 'postal-code'
              : fieldKey === 'cardName' ? 'card-name'
              : fieldKey === 'cardNumber' ? 'card-number'
              : fieldKey === 'expiry' ? 'card-expiry'
              : fieldKey;

            const input = document.getElementById(inputId);
            if (input) {
              touched.add(inputId);
              input.classList.add('is-invalid');
              const errorEl = getOrCreateErrorElement(input);
              errorEl.textContent = errorMsg;
            }
          });
        }
        showToast(err.message || 'Error processing your order.', 'error');
      }
    });
  }

  // Initialize
  restoreDraft();
  // loadOrderSummary() resolves whether the cart ships anything (cartHasPhysical)
  // and only then is the country/address checking meaningful, so the submit
  // state is recomputed once it settles. updateSubmitState() runs immediately too
  // so the button is not left in an unknown state while the request is in flight.
  updateSubmitState();
  loadOrderSummary().then(() => {
    updateSubmitState();
    // Re-check anything the buyer already typed against the resolved cart.
    touched.forEach((id) => validateField(id));
  });
})();
