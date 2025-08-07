import { useState } from 'react';
import { Search, Plus, User, Menu, Leaf } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Link } from 'react-router-dom';
import GreenThumrLogo from './assets/GreenThumrLogoV1.png'; // Adjust the path as necessary

interface HeaderProps {
  onSearch: (query: string) => void;
  onAddListing: () => void;
  onMenuToggle: () => void;
}

export function Header({ onSearch, onAddListing, onMenuToggle}: HeaderProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [createNewPlant, setCreateNewPlant] = useState(true);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(searchQuery);
  };
  // const handleAddListing = (e: React.FormEvent) => {
  //   e.preventDefault();
  //   onCreateNewPlant(createNewPlant);
  // };

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-green-100">
      <div className="container mx-auto px-4 h-16 flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="md:hidden"
            onClick={onMenuToggle}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <img src={GreenThumrLogo} alt="GreenThumr Logo" className="h-12 w-12" />
            {/* <div className="gray-background p-2 rounded-lg">
              
            </div> */}
            <div className="hidden sm:block">
              <h1 className="text-xl oxygen-bold text-green-800">Thumr</h1>
              <p className="text-xs text-green-600">Buy • Sell • Trade</p>
            </div>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-lg mx-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search plants, flowers, herbs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-green-50/50 border-green-200 focus:border-green-400 focus:ring-green-400"
            />
          </div>
        </form>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Link to="/signup">
            <Button
              className="hidden sm:flex bg-green-600 hover:bg-green-700 text-white"
            >
              Login
            </Button>
          </Link>

          <Link to="/signup">
            <Button
              className="hidden sm:flex bg-green-600 hover:bg-green-700 text-white"
            >
              Signup
            </Button>
          </Link>

          <Button
            onClick={onAddListing}
            className="hidden sm:flex bg-green-600 hover:bg-green-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Sell Plant
          </Button>

          <Button
            onClick={onAddListing}
            className="sm:hidden bg-green-600 hover:bg-green-700 text-white"
            size="sm"
          >
            <Plus className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="sm" className="relative">
            <User className="h-5 w-5" />
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              3
            </Badge>
          </Button>
        </div>
      </div>
    </header>
  );
}