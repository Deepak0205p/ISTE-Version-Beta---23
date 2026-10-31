import { ExpenseCategory } from '../types';

export interface MerchantRule {
  regex: RegExp;
  category: ExpenseCategory;
  subcategory?: string;
  isRecurring?: boolean;
}

/**
 * 120+ Indian FinTech, E-Commerce, Food, Fuel, Utility, Health & Loan Lexicon
 */
export const INDIAN_MERCHANT_LEXICON: MerchantRule[] = [
  // Food & Grocery
  { regex: /swiggy|bundl/i, category: 'Grocery & Food', subcategory: 'Online Food Delivery' },
  { regex: /zomato|eternal/i, category: 'Grocery & Food', subcategory: 'Online Food Delivery' },
  { regex: /zepto|kirana/i, category: 'Grocery & Food', subcategory: 'Quick Commerce Grocery' },
  { regex: /blinkit|grofers/i, category: 'Grocery & Food', subcategory: 'Quick Commerce Grocery' },
  { regex: /instamart/i, category: 'Grocery & Food', subcategory: 'Quick Commerce Grocery' },
  { regex: /bb daily|bigbasket|supermarket/i, category: 'Grocery & Food', subcategory: 'Pantry & Supermarket' },
  { regex: /dmart|avenue supermarts/i, category: 'Grocery & Food', subcategory: 'Supermarket Provisions' },
  { regex: /nature basket|spencer|reliance fresh|smart point/i, category: 'Grocery & Food', subcategory: 'Supermarket' },
  { regex: /mcdonalds|burger king|kfc|domino|starbucks|chaayos/i, category: 'Grocery & Food', subcategory: 'Dining Out' },

  // Transportation & Fuel
  { regex: /uber|ola cabs|rapido/i, category: 'Transportation & Fuel', subcategory: 'Ride Hailing' },
  { regex: /irctc|railways/i, category: 'Transportation & Fuel', subcategory: 'Train Travel' },
  { regex: /indigo|air india|akasa|vistara|spicejet/i, category: 'Transportation & Fuel', subcategory: 'Air Travel' },
  { regex: /iocl|indianoil|bpcl|bharat petroleum|hpcl|hindustan petroleum|shell fuel/i, category: 'Transportation & Fuel', subcategory: 'Vehicle Fuel' },
  { regex: /fastag|nhai|toll/i, category: 'Transportation & Fuel', subcategory: 'Highway Tolls' },

  // Electricity & Utilities
  { regex: /bses|tata power|adani electricity|bescom|tneb|uppcl|dhbvn/i, category: 'Electricity & Utilities', subcategory: 'Electricity Bill', isRecurring: true },
  { regex: /igl|indraprastha gas|mahanagar gas|gujarat gas|adani gas/i, category: 'Electricity & Utilities', subcategory: 'Piped Natural Gas', isRecurring: true },
  { regex: /delhi jal board|water board|bwssb/i, category: 'Electricity & Utilities', subcategory: 'Municipal Water', isRecurring: true },

  // Subscriptions & Broadband
  { regex: /airtel|jio|vodafone|vi india/i, category: 'Subscriptions', subcategory: 'Mobile & Fiber Broadband', isRecurring: true },
  { regex: /act fibernet|hathway|tatasky|tata play/i, category: 'Subscriptions', subcategory: 'Broadband & DTH', isRecurring: true },
  { regex: /netflix|prime video|disney\+? hotstar|spotify|youtube prem/i, category: 'Subscriptions', subcategory: 'Digital Streaming OTT', isRecurring: true },
  { regex: /google one|apple\.com\/bill|icloud|microsoft 365/i, category: 'Subscriptions', subcategory: 'Cloud Storage', isRecurring: true },

  // Shopping & E-Commerce
  { regex: /amazon|amzn mktp/i, category: 'Shopping', subcategory: 'E-Commerce Marketplace' },
  { regex: /flipkart/i, category: 'Shopping', subcategory: 'E-Commerce Marketplace' },
  { regex: /myntra|ajio|tata cliq|nykaa|zara|h&m/i, category: 'Shopping', subcategory: 'Apparel & Lifestyle' },
  { regex: /croma|vijay sales|reliance digital/i, category: 'Shopping', subcategory: 'Consumer Electronics' },

  // Medical & Health
  { regex: /apollo|max healthcare|fortis|manipal|medanta|narayana/i, category: 'Medical & Health', subcategory: 'Hospitalization & Consultation' },
  { regex: /1mg|pharmeasy|netmeds|medplus/i, category: 'Medical & Health', subcategory: 'Pharmacy & Medicines' },
  { regex: /lal pathlabs|dr lal|metropolis|thyrocare|srl diag/i, category: 'Medical & Health', subcategory: 'Diagnostics & Pathology' },

  // Education
  { regex: /school|college|university|vidyalaya|dps |ryan /i, category: 'Education', subcategory: 'Tuition Fees' },
  { regex: /allen|fiitjee|aakash|byju|unacademy|vedantu/i, category: 'Education', subcategory: 'Coaching & Prep' },

  // Loans, EMI & Credit Card Bills (Also evaluated for Internal Transfers)
  { regex: /emi|loan rep|sbi maxgain|hdfc loan|bajaj fin|idfc first bank emi/i, category: 'Loan Repayments / EMI', subcategory: 'Loan EMI Payment', isRecurring: true },
  { regex: /cred|credit card pay|hdfc cc bill|sbi card/i, category: 'Loan Repayments / EMI', subcategory: 'Credit Card Bill' },

  // Insurance
  { regex: /lic |hdfc life|icici pru|max life|star health|care health|hdfc ergo/i, category: 'Insurance', subcategory: 'Life & Health Premium', isRecurring: true },

  // Salary & Inflows
  { regex: /salary|payroll|wages|retainer|stipend/i, category: 'Household', subcategory: 'Earned Salary Inflow' }
];

export function categorizeDescriptor(description: string): { category: ExpenseCategory; subcategory?: string; isRecurring?: boolean } {
  const normalized = description.toLowerCase().trim();
  for (const rule of INDIAN_MERCHANT_LEXICON) {
    if (rule.regex.test(normalized)) {
      return {
        category: rule.category,
        subcategory: rule.subcategory,
        isRecurring: rule.isRecurring
      };
    }
  }
  return { category: 'Miscellaneous' };
}

