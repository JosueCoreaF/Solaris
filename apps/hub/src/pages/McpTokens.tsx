import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import apiClient from '../services/api';
import {
  Key,
  Plus,
  Trash2,
  Copy,
  RefreshCw,
  Sparkles,
  Globe,
  BookOpen,
  Info,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Shield,
} from 'lucide-react';

interface McpToken {
  id: string;
  api_token: string;
  token_expires: string;
  created_at: string;
  last_used_at: string | null;
  description: string | null;
}

export const McpTokens: React.FC = () => {
  const { session } = useAuth();
  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [desc, setDesc] = useState('');
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'claude_web' | 'claude_desktop' | 'vscode'>('claude_web');
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('mcp_server_url') || 'https://mcp-solarys.vercel.app');

  const fetchTokens = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/hub/mcp/tokens');
      setTokens(res || []);
    } catch (err) {
      console.error('Error fetching MCP tokens:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session) {
      fetchTokens();
    }
  }, [session]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setNewToken(null);
    setError(null);
    try {
      const res = await apiClient.post('/hub/mcp/token', { description: desc });
      if (res?.token) {
        setNewToken(res.token);
        setDesc('');
        fetchTokens();
      } else {
        setError('No se pudo generar el token. Inténtalo de nuevo.');
      }
    } catch (err: any) {
      console.error('Error generating token:', err);
      setError(
        err.response?.data?.error || 
        err.message || 
        'Error de comunicación con el servidor. Por favor, inténtalo de nuevo.'
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas revocar este token? Las integraciones que lo usen perderán el acceso de inmediato.')) return;
    try {
      await apiClient.delete(`/hub/mcp/token/${id}`);
      fetchTokens();
    } catch (err) {
      console.error('Error revoking token:', err);
    }
  };

  const handleReveal = async (id: string) => {
    if (revealed[id]) {
      setRevealed((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    setRevealing((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await apiClient.get(`/hub/mcp/token/${id}/reveal`);
      if (res?.token) {
        setRevealed((prev) => ({ ...prev, [id]: res.token }));
      }
    } catch (err) {
      console.error('Error revealing token:', err);
    } finally {
      setRevealing((prev) => ({ ...prev, [id]: false }));
    }
  };

  const handleCopy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setServerUrl(val);
    localStorage.setItem('mcp_server_url', val);
  };

  const cleanServerUrl = serverUrl.replace(/\/+$/, '');

  const jsonConfigCode = JSON.stringify({
    mcpServers: {
      solaris: {
        command: "node",
        args: ["C:\\\\Ruta\\\\A\\\\Tu\\\\Carpeta\\\\mcp-http-client.js"],
        env: {
          SOLARIS_SERVER_URL: cleanServerUrl,
          SOLARIS_API_TOKEN: newToken || "TU_TOKEN_API_AQUI"
        }
      }
    }
  }, null, 2);

  return (
    <>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <Sparkles className="text-indigo-600 w-6 h-6 animate-pulse" />
            Integración de IA (MCP)
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Conecta la base de datos de tus negocios con Claude, Gemini, ChatGPT o VS Code utilizando Model Context Protocol.
          </p>
        </div>
      </header>

      {/* Main Container */}
      <div className="p-8 w-full max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Columna Izquierda (2/3): Generación y Lista de Tokens */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Nuevo Token Generado Box */}
          {newToken && (
            <div className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-3xl p-6 shadow-md shadow-emerald-50/50">
              <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8" />
              <div className="flex items-start gap-4">
                <div className="bg-emerald-500 text-white p-3 rounded-2xl shadow-sm shadow-emerald-500/20">
                  <Shield size={24} />
                </div>
                <div className="space-y-4 flex-1">
                  <div>
                    <h4 className="font-bold text-emerald-900 text-lg flex items-center gap-2">
                      ¡Token Generado con Éxito!
                    </h4>
                    <p className="text-emerald-700 text-sm mt-1 leading-relaxed">
                      Por motivos de seguridad, **esta es la única vez** que podrás ver este token en su totalidad. Copialo ahora y guárdalo en un lugar seguro.
                    </p>
                  </div>
                  
                  {/* Token Display Field */}
                  <div className="flex items-center gap-2 bg-white border border-emerald-200 p-3 rounded-2xl shadow-sm mt-2">
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={newToken}
                      readOnly
                      className="text-emerald-800 text-sm font-mono bg-transparent outline-none flex-1 font-semibold tracking-wider select-all border-none focus:ring-0 p-0"
                    />
                    
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => setShowToken(!showToken)}
                        className="p-2 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 rounded-xl transition-colors"
                        title={showToken ? 'Ocultar token' : 'Mostrar token'}
                      >
                        {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                      <div className="w-[1px] h-6 bg-emerald-100" />
                      <button
                        onClick={() => handleCopy(newToken)}
                        className="p-2 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 rounded-xl transition-colors flex items-center gap-1.5 px-3 font-semibold text-xs border border-emerald-100 bg-emerald-50/30"
                        title="Copiar token"
                      >
                        {copied ? (
                          <>
                            <CheckCircle2 size={15} className="text-emerald-600" />
                            <span>Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy size={15} />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Vercel SSE URL helper */}
                  <div className="bg-emerald-500/5 border border-emerald-100 p-3.5 rounded-2xl text-xs space-y-2 text-emerald-800">
                    <p className="font-semibold flex items-center gap-1.5">
                      <Globe size={13} className="text-emerald-600" /> Enlace de Conexión Directa (Claude.ai Web):
                    </p>
                    <div className="flex items-center gap-2 bg-white/80 border border-emerald-100/50 p-2 rounded-xl">
                      <code className="flex-1 font-mono text-[11px] truncate select-all">{`${cleanServerUrl}/?token=${newToken}`}</code>
                      <button
                        onClick={() => handleCopy(`${cleanServerUrl}/?token=${newToken}`)}
                        className="text-emerald-600 hover:text-emerald-700 p-1 hover:bg-emerald-100 rounded"
                        title="Copiar URL de conexión"
                      >
                        <Copy size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generar nuevo token */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-indigo-600" /> Generar Nuevo Token MCP
            </h3>
            
            {/* Visual Error Message */}
            {error && (
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 mb-4 flex items-start gap-3 text-rose-800 animate-fadeIn">
                <AlertCircle className="shrink-0 text-rose-500 w-5 h-5 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-bold">Error de Generación</p>
                  <p className="text-rose-600 mt-0.5">{error}</p>
                </div>
                <button 
                  onClick={() => setError(null)}
                  className="text-rose-400 hover:text-rose-600 font-bold text-xs p-1"
                >
                  Descartar
                </button>
              </div>
            )}

            <form onSubmit={handleGenerate} className="flex flex-col sm:flex-row gap-4 items-end">
              <div className="flex-1 w-full space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Descripción / Dispositivo (Opcional)
                </label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Ej. Claude Desktop de Casa, VS Code, Gemini Web..."
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl transition-all outline-none text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={generating}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white px-7 py-3 rounded-2xl text-sm font-semibold transition-all shadow-sm shadow-indigo-100 hover:shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus size={18} />}
                Crear Token
              </button>
            </form>
          </div>

          {/* Lista de Tokens */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-600" /> Tokens API Activos
            </h3>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
              </div>
            ) : tokens.length === 0 ? (
              <div className="text-center py-16 border-2 border-dashed border-slate-100 rounded-2xl">
                <Shield className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm font-medium">No tienes ningún token activo</p>
                <p className="text-slate-400 text-xs mt-1">Genera un token arriba para conectar tu IA preferida.</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-6 sm:mx-0">
                <table className="w-full text-left text-sm min-w-[600px]">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="py-3 px-6">Descripción</th>
                      <th className="py-3 px-6">Token (Seguro)</th>
                      <th className="py-3 px-6">Creado</th>
                      <th className="py-3 px-6">Último Uso</th>
                      <th className="py-3 px-6 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokens.map((t) => (
                      <tr key={t.id} className="border-b border-slate-50 text-slate-700 hover:bg-slate-50/50 transition-colors">
                        <td className="py-4 px-6 font-semibold text-slate-900">{t.description || 'Sin descripción'}</td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-xs px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg border border-slate-200/50">
                              {revealed[t.id] || t.api_token}
                            </span>
                            {revealed[t.id] && (
                              <button
                                onClick={() => handleCopy(revealed[t.id])}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Copiar token completo"
                              >
                                <Copy size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-6 text-slate-500 text-xs">
                          {new Date(t.created_at).toLocaleDateString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                        <td className="py-4 px-6 text-slate-500 text-xs">
                          {t.last_used_at ? (
                            <span className="text-indigo-600 font-medium bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100/50">
                              {new Date(t.last_used_at).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Nunca</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleReveal(t.id)}
                              disabled={revealing[t.id]}
                              className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-transparent hover:border-indigo-100 disabled:opacity-50"
                              title={revealed[t.id] ? 'Ocultar token' : 'Ver token completo'}
                            >
                              {revealing[t.id] ? (
                                <RefreshCw size={15} className="animate-spin" />
                              ) : revealed[t.id] ? (
                                <EyeOff size={15} />
                              ) : (
                                <Eye size={15} />
                              )}
                            </button>
                            <button
                              onClick={() => handleRevoke(t.id)}
                              className="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors border border-transparent hover:border-rose-100"
                              title="Revocar Token"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Columna Derecha (1/3): Configuración e Instrucciones */}
        <div className="space-y-8">
          
          {/* Servidor Cloud URL input */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600" /> Servidor en la Nube
            </h3>
            <p className="text-slate-500 text-xs leading-relaxed">
              Ingresa la URL pública de tu deployment de Vercel del MCP para autocompletar la configuración:
            </p>
            <input
              type="text"
              value={serverUrl}
              onChange={handleUrlChange}
              placeholder="https://mcp-solarys.vercel.app"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl transition-all outline-none text-sm font-mono font-semibold text-slate-700"
            />
          </div>

          {/* Guía Rápida Tabulada */}
          <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 shadow-md space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-full -mr-8 -mt-8" />
            
            <div className="flex items-center gap-2 text-indigo-400">
              <BookOpen size={20} />
              <h4 className="font-bold text-md text-white">Guía de Configuración</h4>
            </div>

            {/* Selector de Pestañas */}
            <div className="flex border-b border-slate-800 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('claude_web')}
                className={`pb-2.5 px-2.5 transition-all border-b-2 -mb-[2px] ${
                  activeTab === 'claude_web'
                    ? 'border-indigo-500 text-white font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Claude.ai (Web)
              </button>
              <button
                onClick={() => setActiveTab('claude_desktop')}
                className={`pb-2.5 px-2.5 transition-all border-b-2 -mb-[2px] ${
                  activeTab === 'claude_desktop'
                    ? 'border-indigo-500 text-white font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Claude Desktop
              </button>
              <button
                onClick={() => setActiveTab('vscode')}
                className={`pb-2.5 px-2.5 transition-all border-b-2 -mb-[2px] ${
                  activeTab === 'vscode'
                    ? 'border-indigo-500 text-white font-bold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                VS Code / Cline
              </button>
            </div>

            {/* Contenido de la Guía */}
            <div className="space-y-4 text-xs leading-relaxed text-slate-300">
              
              {activeTab === 'claude_web' && (
                <div className="space-y-4">
                  <p className="text-slate-400 font-medium">
                    Conecta directamente a Claude Pro mediante la interfaz web de Anthropic:
                  </p>
                  
                  <div className="space-y-3.5">
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                      <p>Ve a Claude.ai y abre los <strong>Ajustes del Perfil (Settings)</strong>.</p>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                      <p>Ve a la sección de <strong>Custom Connectors</strong> (o Conectores MCP).</p>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                      <p>Elige <strong>Add MCP Server</strong> y selecciona la opción de transporte <strong>SSE</strong>.</p>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">4</span>
                      <div className="space-y-1.5 flex-1">
                        <p>Pega la URL de conexión en el campo de dirección:</p>
                        <div className="relative bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center gap-2">
                          <code className="text-emerald-400 font-mono text-[10px] truncate select-all flex-1">
                            {`${cleanServerUrl}/?token=${newToken || 'TU_TOKEN'}`}
                          </code>
                          <button
                            onClick={() => handleCopy(`${cleanServerUrl}/?token=${newToken || 'TU_TOKEN'}`)}
                            className="text-slate-400 hover:text-white p-1 hover:bg-slate-900 rounded"
                            title="Copiar URL"
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">5</span>
                      <p>Deja los campos de autenticación OAuth vacíos. Haz clic en <strong>Create</strong> y listo.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'claude_desktop' && (
                <div className="space-y-4">
                  <p className="text-slate-400 font-medium">
                    Configura tu Claude Desktop para comunicarse localmente con el servidor MCP en la nube:
                  </p>
                  
                  <div className="space-y-3">
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                      <p>Abre el archivo `claude_desktop_config.json` en tu computadora.</p>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                      <div className="space-y-2 flex-1">
                        <p>Pega esta configuración dentro del objeto `"mcpServers"`:</p>
                        <div className="relative">
                          <pre className="bg-slate-950 p-3.5 rounded-xl text-[10px] font-mono text-emerald-400 overflow-x-auto leading-relaxed border border-slate-800">
                            {jsonConfigCode}
                          </pre>
                          <button
                            onClick={() => handleCopy(jsonConfigCode)}
                            className="absolute right-2.5 top-2.5 p-1.5 bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white rounded-lg border border-slate-800 transition-colors"
                            title="Copiar configuración"
                          >
                            <Copy size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                      <p>Reinicia Claude Desktop. Verás aparecer el icono del rayo ⚡ en la esquina de los chats.</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'vscode' && (
                <div className="space-y-4">
                  <p className="text-slate-400 font-medium">
                    Configura extensiones de VS Code como Cline, Roo Code u otros plugins MCP:
                  </p>
                  
                  <div className="space-y-3.5">
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                      <p>Abre los ajustes de MCP de tu extensión de VS Code.</p>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                      <p>Elige añadir un nuevo servidor del tipo **SSE** (Server-Sent Events).</p>
                    </div>
                    <div className="flex gap-2.5">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-indigo-400 text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                      <div className="space-y-1.5 flex-1">
                        <p>Configura la URL de sse con tu token de seguridad:</p>
                        <div className="relative bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex items-center gap-2">
                          <code className="text-emerald-400 font-mono text-[10px] truncate select-all flex-1">
                            {`${cleanServerUrl}/sse?token=${newToken || 'TU_TOKEN'}`}
                          </code>
                          <button
                            onClick={() => handleCopy(`${cleanServerUrl}/sse?token=${newToken || 'TU_TOKEN'}`)}
                            className="text-slate-400 hover:text-white p-1 hover:bg-slate-900 rounded"
                            title="Copiar URL SSE"
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            <div className="border-t border-slate-800 pt-4 flex items-center gap-2 text-[11px] text-slate-400">
              <Info size={13} className="text-indigo-400" />
              <span>Solo tú tienes acceso a generar y configurar tokens para tus negocios.</span>
            </div>
          </div>

        </div>

      </div>
    </>
  );
};

const Loader2 = ({ className, ...props }: React.ComponentProps<'svg'>) => (
  <svg
    className={`animate-spin ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);
