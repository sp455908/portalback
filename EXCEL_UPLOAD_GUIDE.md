# Excel Upload Feature for Practice Tests

This feature allows admins to upload Excel files containing questions, options, and answers to create or update practice tests.

## Features

- ✅ Upload Excel files (.xlsx, .xls) with questions
- ✅ Create new practice tests from Excel data
- ✅ Update existing practice tests with Excel data
- ✅ Automatic validation of Excel format
- ✅ Support for multiple correct answer formats (A, B, C, D or 1, 2, 3, 4)
- ✅ Minimum 10 questions requirement
- ✅ Duplicate title prevention

## API Endpoints

### 1. Create Practice Test from Excel
```
POST /api/practice-tests/admin/import-excel
Content-Type: multipart/form-data
Authorization: Bearer <admin_token>

Form Data:
- excelFile: Excel file (.xlsx or .xls)
- title: Practice test title
- description: Practice test description (optional)
- category: Practice test category
- questionsPerTest: Number of questions per test (optional, default: 30)
- duration: Test duration in minutes (optional, default: 30)
- passingScore: Passing percentage (optional, default: 70)
- targetUserType: "student" or "corporate"
```

### 2. Update Practice Test with Excel
```
PUT /api/practice-tests/admin/:testId/update-excel
Content-Type: multipart/form-data
Authorization: Bearer <admin_token>

Form Data:
- excelFile: Excel file (.xlsx or .xls)
- questionsPerTest: Number of questions per test (optional)
- duration: Test duration in minutes (optional)
- passingScore: Passing percentage (optional)
```

## Excel File Format

### Required Headers
The Excel file must have these exact headers in the first row:
- `Question`
- `Option A`
- `Option B`
- `Option C`
- `Option D`
- `Correct Answer`

### Correct Answer Format
The "Correct Answer" column can contain:
- Letters: A, B, C, D (case insensitive)
- Numbers: 1, 2, 3, 4

### Example Excel Structure

| Question | Option A | Option B | Option C | Option D | Correct Answer |
|----------|----------|----------|----------|----------|----------------|
| Which organization oversees international trade rules? | IMF | WTO | UNCTAD | WCO | B |
| What is a Letter of Credit? | Invoice | Payment order | Bank guarantee | Receipt | C |

## Validation Rules

1. **Minimum Questions**: At least 10 valid questions required
2. **Required Fields**: All columns must be filled for each question
3. **Correct Answer**: Must be A, B, C, D or 1, 2, 3, 4
4. **File Size**: Maximum 10MB
5. **File Type**: Only .xlsx and .xls files accepted
6. **Duplicate Titles**: Cannot create test with existing title

## Error Handling

The API returns detailed error messages for:
- Missing required headers
- Invalid file format
- Insufficient questions
- Invalid correct answer format
- Duplicate test titles
- File size exceeded

## Sample Response

### Success Response
```json
{
  "status": "success",
  "message": "Practice test \"International Trade Basics\" created successfully with 15 questions from Excel file",
  "data": {
    "practiceTest": {
      "id": "64f8a1b2c3d4e5f6a7b8c9d0",
      "title": "International Trade Basics",
      "category": "Trade Fundamentals",
      "totalQuestions": 15,
      "questionsPerTest": 30,
      "duration": 30,
      "passingScore": 70,
      "targetUserType": "student"
    }
  }
}
```

### Error Response
```json
{
  "status": "fail",
  "message": "Missing required headers: Option C, Option D. Expected headers: Question, Option A, Option B, Option C, Option D, Correct Answer"
}
```

## Generating Excel Template

Run the following command to generate a sample Excel template:

```bash
npm run create-excel-template
```

This creates `scripts/question_template.xlsx` with sample questions and proper formatting.

## Frontend Integration

### Using FormData (JavaScript)
```javascript
const uploadExcel = async (file, testData) => {
  const formData = new FormData();
  formData.append('excelFile', file);
  formData.append('title', testData.title);
  formData.append('category', testData.category);
  formData.append('targetUserType', testData.targetUserType);
  
  const response = await fetch('/api/practice-tests/admin/import-excel', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData
  });
  
  return response.json();
};
```

### Using Axios
```javascript
const uploadExcel = async (file, testData) => {
  const formData = new FormData();
  formData.append('excelFile', file);
  formData.append('title', testData.title);
  formData.append('category', testData.category);
  formData.append('targetUserType', testData.targetUserType);
  
  const response = await axios.post('/api/practice-tests/admin/import-excel', formData, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'multipart/form-data'
    }
  });
  
  return response.data;
};
```

## Security Features

- ✅ Admin-only access
- ✅ File type validation
- ✅ File size limits
- ✅ Input sanitization
- ✅ Error handling

## Dependencies

- `xlsx`: Excel file processing
- `multer`: File upload handling

## Installation

The required dependencies are already installed:
```bash
npm install xlsx multer
```

## Testing

1. Generate the template: `npm run create-excel-template`
2. Modify the template with your questions
3. Use the API endpoints to upload the file
4. Verify the practice test is created/updated correctly 