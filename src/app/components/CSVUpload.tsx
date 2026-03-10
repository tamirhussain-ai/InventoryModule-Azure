import { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Upload, FileText, AlertCircle, CheckCircle2 } from 'lucide-react';
import { bulkUploadItems } from '../services/api';
import { toast } from 'sonner';

interface CSVUploadProps {
  onUploadComplete?: () => void;
}

export function CSVUpload({ onUploadComplete }: CSVUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<any>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile && selectedFile.type === 'text/csv') {
      setFile(selectedFile);
      setResults(null);
    } else {
      toast.error('Please select a valid CSV file');
    }
  };

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/\r$/, ''));
    const items: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle quoted fields and commas within quotes
      const values: string[] = [];
      let currentValue = '';
      let insideQuotes = false;

      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          insideQuotes = !insideQuotes;
        } else if (char === ',' && !insideQuotes) {
          values.push(currentValue.trim().replace(/\r$/, ''));
          currentValue = '';
        } else {
          currentValue += char;
        }
      }
      values.push(currentValue.trim().replace(/\r$/, ''));

      if (values.length !== headers.length) {
        console.warn(`Line ${i + 1} has ${values.length} values but expected ${headers.length}`);
        continue;
      }

      const item: any = {};
      headers.forEach((header, index) => {
        const value = values[index];
        // Map CSV columns to item properties
        switch (header) {
          case 'Item Name':
            item.name = value;
            break;
          case 'Description':
            item.description = value;
            break;
          case 'Category':
            item.category = value;
            break;
          case 'Vendor':
            item.vendor = value;
            break;
          case 'SKU':
            item.sku = value;
            break;
          case 'Internal Code':
            item.itemNumber = value;
            break;
          case 'Unit of Measure':
            item.unitOfMeasure = value;
            break;
          case 'Pack Size':
            item.packSize = value;
            break;
          case 'Cost per Unit':
            item.cost = value;
            break;
          case 'Reorder Threshold':
            item.reorderThreshold = value;
            break;
          case 'Max Par Level':
            item.maxPar = value;
            break;
          case 'Lead Time (days)':
            item.leadTimeDays = value;
            break;
          case 'Product Image URL':
            item.productImageUrl = value;
            break;
        }
      });

      if (item.name) {
        items.push(item);
      }
    }

    console.log('Parsed items from CSV:', items);
    return items;
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);
    setResults(null);

    try {
      const text = await file.text();
      const items = parseCSV(text);

      if (items.length === 0) {
        toast.error('No valid items found in CSV');
        setUploading(false);
        return;
      }

      console.log(`Parsed ${items.length} items from CSV`);
      
      const response = await bulkUploadItems(items);
      
      setResults(response.results);
      
      if (response.results.created > 0 || response.results.updated > 0) {
        const message = [];
        if (response.results.created > 0) message.push(`${response.results.created} created`);
        if (response.results.updated > 0) message.push(`${response.results.updated} updated`);
        toast.success(`Successfully processed: ${message.join(', ')}!`);
        if (onUploadComplete) {
          onUploadComplete();
        }
      }
      
      if (response.results.failed > 0) {
        toast.error(`${response.results.failed} items failed to upload. See details below.`);
      }
      
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload items');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Upload className="h-5 w-5 mr-2" />
          CSV Bulk Upload
        </CardTitle>
        <CardDescription>
          Upload items from a CSV file. The CSV should have the following columns (in any order):
        </CardDescription>
        <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
          <li><strong>Item Name</strong> (required)</li>
          <li>Description</li>
          <li>Category</li>
          <li>Vendor</li>
          <li>SKU</li>
          <li>Internal Code</li>
          <li>Unit of Measure</li>
          <li>Pack Size</li>
          <li>Cost per Unit</li>
          <li>Reorder Threshold</li>
          <li>Max Par Level</li>
          <li>Lead Time (days)</li>
          <li>Product Image URL</li>
        </ul>
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-900">
            <strong>Smart Duplicate Handling:</strong> Items are matched by name, SKU, or internal code. 
            Existing items will only have their <em>empty fields</em> filled in - existing data won't be overwritten.
          </p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            id="csv-upload"
            disabled={uploading}
          />
          <label htmlFor="csv-upload">
            <Button
              variant="outline"
              className="cursor-pointer"
              disabled={uploading}
              asChild
            >
              <span>
                <FileText className="h-4 w-4 mr-2" />
                {file ? file.name : 'Choose CSV File'}
              </span>
            </Button>
          </label>
          
          {file && (
            <Button 
              onClick={handleUpload} 
              disabled={uploading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {uploading ? 'Uploading...' : 'Upload Items'}
            </Button>
          )}
        </div>

        {results && (
          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600 mr-2" />
                  <div>
                    <div className="font-semibold text-green-900">Created</div>
                    <div className="text-2xl font-bold text-green-700">{results.created || 0}</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle2 className="h-5 w-5 text-blue-600 mr-2" />
                  <div>
                    <div className="font-semibold text-blue-900">Updated</div>
                    <div className="text-2xl font-bold text-blue-700">{results.updated || 0}</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                  <div>
                    <div className="font-semibold text-red-900">Failed</div>
                    <div className="text-2xl font-bold text-red-700">{results.failed}</div>
                  </div>
                </div>
              </div>
            </div>

            {results.errors && results.errors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-semibold text-red-900 mb-2">Errors:</h4>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {results.errors.map((error: any, index: number) => (
                    <div key={index} className="text-sm text-red-700">
                      <strong>Row {error.row}:</strong> {error.name} - {error.error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}