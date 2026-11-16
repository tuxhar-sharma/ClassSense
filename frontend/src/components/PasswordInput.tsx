import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return <div className="relative w-full">
    <input aria-label="Password" {...props} type={visible ? 'text' : 'password'} className={props.className} style={{...props.style, paddingRight: '4.5rem'}} />
    <button type="button" aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}
      onClick={() => setVisible(value => !value)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-600 hover:bg-slate-100 flex items-center gap-1 text-xs">
      {visible ? <EyeOff size={16} /> : <Eye size={16} />}{visible ? 'Hide' : 'Show'}
    </button>
  </div>;
}
