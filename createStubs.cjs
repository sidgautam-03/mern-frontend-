const fs = require('fs');
const path = require('path');

const stub = (name) =>
  `const ${name} = () => <div className="p-6">${name}</div>;\n\nexport default ${name};\n`;

const files = {
  'src/pages/HomePage.jsx': 'HomePage',
  'src/pages/ProductListPage.jsx': 'ProductListPage',
  'src/pages/CartPage.jsx': 'CartPage',
  'src/pages/CheckoutPage.jsx': 'CheckoutPage',
  'src/pages/OrderSuccessPage.jsx': 'OrderSuccessPage',
  'src/pages/LoginPage.jsx': 'LoginPage',
  'src/pages/admin/ProductFormPage.jsx': 'ProductFormPage',
};

for (const [file, name] of Object.entries(files)) {
  if (fs.existsSync(file)) {
    console.log('exists, skipped:', file);
    continue;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, stub(name));
  console.log('created:', file);
}