const Footer = () => {
    return (
      <footer className="bg-white border-t border-gray-200 py-6 mt-12 text-center text-xs text-gray-500">
        <div className="container mx-auto px-4">
          <p>&copy; {new Date().getFullYear()} MERNShop. All rights reserved.</p>
        </div>
      </footer>
    );
  };
  
  export default Footer;