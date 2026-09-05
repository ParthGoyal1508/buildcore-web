'use client';

import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { searchGroupEmployees } from '@/app/lib/api/dashboard';
import { EMPLOYEE_SEARCH_DEBOUNCE_MS } from '@/app/lib/constants';

/**
 * Debounced cross-company employee search (spec FR-011): no request fires below two
 * characters, and typing is debounced so a partial term is not a request per keystroke.
 */
export default function EmployeeSearch() {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(
      () => setDebounced(term.trim()),
      EMPLOYEE_SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(id);
  }, [term]);

  const results = useQuery({
    queryKey: ['group-employee-search', debounced],
    queryFn: () => searchGroupEmployees(debounced),
    enabled: debounced.length >= 2,
  });

  return (
    <div>
      <label className="block text-sm">
        <span className="mb-1 block text-gray-700">Search employees</span>
        <input
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Name or code (min 2 characters)"
          className="block w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </label>

      {debounced.length >= 2 && (
        <div className="mt-3">
          {results.isPending && (
            <p className="text-sm text-gray-500" role="status">
              Searching…
            </p>
          )}
          {results.isError && (
            <p className="text-sm text-red-600" role="alert">
              Search failed.
            </p>
          )}
          {results.data && results.data.length === 0 && (
            <p className="text-sm text-gray-500">No matches.</p>
          )}
          {results.data && results.data.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-md border border-gray-200 bg-white">
              {results.data.map((emp) => (
                <li key={emp.id} className="px-3 py-2 text-sm">
                  <span className="font-medium text-gray-900">{emp.name}</span>{' '}
                  <span className="text-gray-500">({emp.employeeCode})</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
