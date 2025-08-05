const XLSX = require('xlsx');
const path = require('path');

// Sample questions data
const sampleQuestions = [
  {
    'Question': 'Which organization oversees international trade rules and resolves disputes?',
    'Option A': 'IMF',
    'Option B': 'WTO',
    'Option C': 'UNCTAD',
    'Option D': 'WCO',
    'Correct Answer': 'B'
  },
  {
    'Question': 'INCOTERMS are used to:',
    'Option A': 'Determine quality standards',
    'Option B': 'Define trade tariffs',
    'Option C': 'Define responsibilities of buyers and sellers',
    'Option D': 'Determine customs duties',
    'Correct Answer': 'C'
  },
  {
    'Question': 'What is a Letter of Credit (LC)?',
    'Option A': 'An invoice from the exporter',
    'Option B': 'A payment order from the importer',
    'Option C': 'A financial guarantee by a bank',
    'Option D': 'A receipt issued by customs',
    'Correct Answer': 'C'
  },
  {
    'Question': 'Which document is issued by a carrier as a receipt of cargo and contract of carriage?',
    'Option A': 'Bill of Entry',
    'Option B': 'Commercial Invoice',
    'Option C': 'Certificate of Origin',
    'Option D': 'Bill of Lading',
    'Correct Answer': 'D'
  },
  {
    'Question': 'What is the primary goal of international trade agreements?',
    'Option A': 'Increase tariffs',
    'Option B': 'Simplify domestic regulations',
    'Option C': 'Reduce trade barriers',
    'Option D': 'Promote regional monopolies',
    'Correct Answer': 'C'
  },
  {
    'Question': 'What does CIF stand for in international trade?',
    'Option A': 'Cost, Insurance, and Freight',
    'Option B': 'Carriage and Insurance Paid',
    'Option C': 'Cost Including Freight',
    'Option D': 'Carriage, Insurance, and Freight',
    'Correct Answer': 'A'
  },
  {
    'Question': 'Which document certifies the origin of goods?',
    'Option A': 'Bill of Lading',
    'Option B': 'Commercial Invoice',
    'Option C': 'Certificate of Origin',
    'Option D': 'Packing List',
    'Correct Answer': 'C'
  },
  {
    'Question': 'What is the purpose of a Bill of Entry?',
    'Option A': 'To declare goods for import',
    'Option B': 'To certify quality standards',
    'Option C': 'To provide insurance coverage',
    'Option D': 'To arrange transportation',
    'Correct Answer': 'A'
  },
  {
    'Question': 'Which international organization sets standards for customs procedures?',
    'Option A': 'WTO',
    'Option B': 'WCO',
    'Option C': 'IMF',
    'Option D': 'UNCTAD',
    'Correct Answer': 'B'
  },
  {
    'Question': 'What is the Harmonized System (HS) used for?',
    'Option A': 'Currency exchange rates',
    'Option B': 'Classification of goods',
    'Option C': 'Trade agreements',
    'Option D': 'Insurance policies',
    'Correct Answer': 'B'
  }
];

// Create workbook and worksheet
const workbook = XLSX.utils.book_new();
const worksheet = XLSX.utils.json_to_sheet(sampleQuestions);

// Add the worksheet to the workbook
XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

// Set column widths
const colWidths = [
  { wch: 50 }, // Question
  { wch: 30 }, // Option A
  { wch: 30 }, // Option B
  { wch: 30 }, // Option C
  { wch: 30 }, // Option D
  { wch: 15 }  // Correct Answer
];
worksheet['!cols'] = colWidths;

// Write the file
const outputPath = path.join(__dirname, 'question_template.xlsx');
XLSX.writeFile(workbook, outputPath);

console.log('Excel template created successfully at:', outputPath);
console.log('\nTemplate includes:');
console.log('- Required headers: Question, Option A, Option B, Option C, Option D, Correct Answer');
console.log('- Sample questions for reference');
console.log('- Correct Answer format: A, B, C, or D (case insensitive)');
console.log('\nInstructions for admins:');
console.log('1. Use this template as a reference for the required format');
console.log('2. Fill in your questions following the same structure');
console.log('3. Ensure Correct Answer column contains A, B, C, or D');
console.log('4. Upload the Excel file using the /admin/import-excel endpoint'); 