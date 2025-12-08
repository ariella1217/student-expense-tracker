
import * as SQLite from 'expo-sqlite';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Import PieChart and BarChart from react-native-chart-kit
import { PieChart } from 'react-native-chart-kit';

// Import Dimensions for responsive chart width
import { Dimensions } from 'react-native';


// Open SQLite database
const db = SQLite.openDatabaseSync('expenses.db');
// Get screen width for responsive charts
const screenWidth = Dimensions.get('window').width;

export default function ExpenseTracker() {
  
  const [expenses, setExpenses] = useState<any[]>([]);
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [note, setNote] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
const [currentFilter, setCurrentFilter] = useState('All');
const [filteredExpenses, setFilteredExpenses] = useState<any[]>([]);

const [editModalVisible, setEditModalVisible] = useState(false);
const [editingExpense, setEditingExpense] = useState<any>(null);
const [editAmount, setEditAmount] = useState('');
const [editCategory, setEditCategory] = useState('Food');
const [editNote, setEditNote] = useState('');
const [editDate, setEditDate] = useState('');

// Chart visibility toggle state
const [showPieChart, setShowPieChart] = useState(true);
const [showBarChart, setShowBarChart] = useState(false);

const FILTERS = ['All', 'This Week', 'This Month'];

  const CATEGORIES = ['Food', 'Books', 'Rent', 'Transportation', 'Entertainment', 'Other'];
  // Category colors for pie chart
  const CATEGORY_COLORS: { [key: string]: string } = {
    'Food': '#3b82f6',
    'Books': '#10b981',
    'Rent': '#f59e0b',
    'Transportation': '#ef4444',
    'Entertainment': '#8b5cf6',
    'Other': '#6b7280',
  };


  // Initialize database on app start
  useEffect(() => {
  const setup = async () => {
    await initDatabase();
    await loadExpenses();
  };
  setup();
}, []);

 // Apply filter whenever expenses or filter changes
useEffect(() => {
  if (expenses.length >= 0) {
    applyFilter();
  }
}, [expenses, currentFilter]);

  // Create expenses table if it doesn't exist
  const initDatabase = async () => {
  try {
    // Drop the old table
    await db.execAsync('DROP TABLE IF EXISTS expenses;');
    console.log('🗑️ Dropped old table');
    
    // Small delay to ensure clean state
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Create new table with date column
    await db.execAsync(`
      CREATE TABLE expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        note TEXT,
        date TEXT NOT NULL
      );
    `);
    console.log('✅ Database initialized with date column');
    
    // Return true to indicate success
    return true;
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    return false;
  }
};

// Load all expenses from database
const loadExpenses = async () => {
  try {
    const results = await db.getAllAsync('SELECT * FROM expenses ORDER BY date DESC;');
    setExpenses(results);
    console.log('✅ Expenses loaded:', results);
  } catch (error) {
    console.error('❌ Error loading expenses:', error);
  }
};




  // Apply date filter
  const applyFilter = React.useCallback(() => {
    const today = new Date();
    let filtered = [...expenses];

    if (currentFilter === 'This Week') {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      weekStart.setHours(0, 0, 0, 0);
      
      filtered = expenses.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate >= weekStart;
      });
    } else if (currentFilter === 'This Month') {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      
      filtered = expenses.filter(exp => {
        const expDate = new Date(exp.date);
        return expDate >= monthStart;
      });
    }

    setFilteredExpenses(filtered);
  }, [expenses, currentFilter]);

  // Calculate overall total spending
const calculateTotals = () => {
  const overall = filteredExpenses.reduce((sum, expense) => {
    return sum + parseFloat(expense.amount);
  }, 0);

  return overall;
};


// Calculate spending by category
const calculateCategoryTotals = () => {
  const categoryTotals: { [key: string]: number } = {};
  
  filteredExpenses.forEach(expense => {
    const cat = expense.category;
    const amount = parseFloat(expense.amount);
    
    if (categoryTotals[cat]) {
      categoryTotals[cat] += amount;
    } else {
      categoryTotals[cat] = amount;
    }
  });
  
  return categoryTotals;
};

// Function to get pie chart data from category totals
const getPieChartData = () => {
  const categoryTotals = calculateCategoryTotals();
  
  return Object.entries(categoryTotals).map(([category, amount]) => ({
    name: category,  // Just the category name
    population: amount,
    color: CATEGORY_COLORS[category] || '#6b7280',
    legendFontColor: '#374151',
    legendFontSize: 12,
  }));
};

// Function to prepare bar chart data for daily spending trends
const getBarChartData = () => {
  const dailyTotals: { [key: string]: number } = {};
  
  filteredExpenses.forEach(expense => {
    const date = expense.date;
    const amount = parseFloat(expense.amount);
    
    if (dailyTotals[date]) {
      dailyTotals[date] += amount;
    } else {
      dailyTotals[date] = amount;
    }
  });
  
  const labels = Object.keys(dailyTotals).sort();
  const data = labels.map(date => dailyTotals[date]);
  const recentLabels = labels.slice(-7);
  const recentData = recentLabels.map(date => dailyTotals[date]);

  return {
    labels: recentLabels,
    datasets: [{ data: recentData }],
  };
};


  // Add new expense to database
  const addExpense = async () => {
    // Validate
    if (!amount || isNaN(parseFloat(amount))) {
      Alert.alert('Invalid Input', 'Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) <= 0) {
      Alert.alert('Invalid Input', 'Amount must be greater than 0');
      return;
    }

    try {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  await db.runAsync(
    'INSERT INTO expenses (amount, category, note, date) VALUES (?, ?, ?, ?)',
    [parseFloat(amount), category, note, today]
  );

  console.log('✅ Expense added with date:', today);

      // Clear form and close modal
      setAmount('');
      setCategory('Food');
      setNote('');
      setModalVisible(false);
      
      // Reload expenses
      loadExpenses();
      
      Alert.alert('Success', 'Expense added successfully!');
    } catch (error) {
      console.error('❌ Error adding expense:', error);
      Alert.alert('Error', 'Failed to add expense');
    }
  };

  // Delete expense from database
  const deleteExpense = async (id: number) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await db.runAsync('DELETE FROM expenses WHERE id = ?', [id]);
              console.log('✅ Expense deleted:', id);
              loadExpenses();
              Alert.alert('Success', 'Expense deleted successfully');
            } catch (error) {
              console.error('❌ Error deleting expense:', error);
              Alert.alert('Error', 'Failed to delete expense');
            }
          }
        }
      ]
    );
  };

  // Open edit modal with expense data
// Open edit modal with expense data
const openEditModal = (expense: any) => {
  console.log('🔍 Opening edit modal for:', expense);
  setEditingExpense(expense);
  setEditAmount(expense.amount.toString());
  setEditCategory(expense.category);
  setEditNote(expense.note || '');
  setEditDate(expense.date);
  setEditModalVisible(true);
  console.log('✅ Edit modal should be visible now');
};

// Update expense in database
const updateExpense = async () => {
  if (!editAmount || isNaN(parseFloat(editAmount))) {
    Alert.alert('Invalid Input', 'Please enter a valid amount');
    return;
  }

  if (parseFloat(editAmount) <= 0) {
    Alert.alert('Invalid Input', 'Amount must be greater than 0');
    return;
  }

  try {
    await db.runAsync(
      'UPDATE expenses SET amount = ?, category = ?, note = ?, date = ? WHERE id = ?',
      [parseFloat(editAmount), editCategory, editNote, editDate, editingExpense.id]
    );

    console.log('✅ Expense updated:', editingExpense.id);
    
    // Close modal and refresh
    setEditModalVisible(false);
    setEditingExpense(null);
    loadExpenses();
    
    Alert.alert('Success', 'Expense updated successfully!');
  } catch (error) {
    console.error('❌ Error updating expense:', error);
    Alert.alert('Error', 'Failed to update expense');
  }
};

const renderExpenseItem = ({ item }: { item: any }) => (
  <View style={styles.expenseItem}>
    <View style={styles.expenseInfo}>
      <Text style={styles.expenseAmount}>${item.amount.toFixed(2)}</Text>
      <Text style={styles.expenseCategory}>{item.category}</Text>
      {item.note ? (
        <Text style={styles.expenseNote}>{item.note}</Text>
      ) : null}
      {item.date ? (
        <Text style={styles.expenseDate}>{item.date}</Text>
      ) : null}
    </View>
    <View style={styles.expenseActions}>
      <TouchableOpacity
        style={styles.editButton}
        onPress={() => openEditModal(item)}
      >
        <Text style={styles.editButtonText}>Edit</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => deleteExpense(item.id)}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  </View>
);

  // Main render
  return (
  <SafeAreaView style={styles.container}>
    <ScrollView 
      showsVerticalScrollIndicator={true}
      contentContainerStyle={{ paddingBottom: 100 }}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Student Expense Tracker</Text>
        <Text style={styles.headerSubtitle}>Track your spending</Text>
      </View>

{/* Filter Buttons */}
<View style={styles.filterContainer}>
  {FILTERS.map(filter => (
    <TouchableOpacity
      key={filter}
      onPress={() => setCurrentFilter(filter)}
      style={[
        styles.filterButton,
        currentFilter === filter && styles.filterButtonActive
      ]}
    >
      <Text style={[
        styles.filterButtonText,
        currentFilter === filter && styles.filterButtonTextActive
      ]}>
        {filter}
      </Text>
    </TouchableOpacity>
  ))}
</View>

{/* Toggle Pie Chart Button */}
<View style={styles.toggleContainer}>
<TouchableOpacity
  style={[
    styles.filterButton,
    showPieChart && styles.filterButtonActive
  ]}
  onPress={() => setShowPieChart(!showPieChart)}
  >
  <Text style={[
    styles.filterButtonText,
    showPieChart && styles.filterButtonTextActive
  ]}>
    {showPieChart ? 'Hide' : 'Show'} Pie Chart
  </Text>
</TouchableOpacity>
</View>


{/* Analytics Section */}
<View style={styles.analyticsSection}>
  {/* Overall Total Card */}
  <View style={styles.totalCard}>
    <Text style={styles.totalLabel}>Total Spending ({currentFilter})</Text>
    <Text style={styles.totalAmount}>${calculateTotals().toFixed(2)}</Text>
    <Text style={styles.totalSubtext}>{filteredExpenses.length} expenses</Text>
  </View>

  {/* Category Breakdown Card */}
  {Object.keys(calculateCategoryTotals()).length > 0 && (
    <View style={styles.categoryCard}>
      <Text style={styles.categoryTitle}>By Category</Text>
      {Object.entries(calculateCategoryTotals())
        .sort((a, b) => b[1] - a[1])
        .map(([category, total]) => (
          <View key={category} style={styles.categoryRow}>
            <Text style={styles.categoryName}>{category}</Text>
            <Text style={styles.categoryAmount}>${total.toFixed(2)}</Text>
          </View>
        ))
      }
    </View>
  )}
</View>

{/* Pie Chart Visualization */}
{showPieChart && Object.keys(calculateCategoryTotals()).length > 0 && (
  <View style={styles.chartCard}>
    <Text style={styles.chartTitle}>Spending by Category</Text>
  <PieChart
    data={getPieChartData()}
    width={screenWidth - 64}
    height={220}
    chartConfig={{
      backgroundColor: '#ffffff',
      backgroundGradientFrom: '#ffffff',
      backgroundGradientTo: '#ffffff',
      color: (opacity = 1) => `rgba(59, 130, 246, ${opacity})`,
    }}
    accessor="population"
    backgroundColor="transparent"
    paddingLeft="15"
    absolute
  />
  </View>
)}



      {/* Expenses List */}
      <FlatList
        data={filteredExpenses}
        renderItem={renderExpenseItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No expenses yet</Text>
            <Text style={styles.emptySubtext}>Tap the + button to add your first expense</Text>
          </View>
        }
      />

      {/* Add Button */}
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.addButtonText}>+</Text>
      </TouchableOpacity>

      {/* Add Expense Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Add New Expense</Text>

              {/* Amount Input */}
              <Text style={styles.inputLabel}>Amount ($)</Text>
              <TextInput
                style={styles.input}
                placeholder="0.00"
                placeholderTextColor="#999"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
              />

              {/* Category Selection */}
              <Text style={styles.inputLabel}>Category</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false}
                style={styles.categoryContainer}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryButton,
                      category === cat && styles.categoryButtonActive
                    ]}
                    onPress={() => setCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryButtonText,
                        category === cat && styles.categoryButtonTextActive
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Note Input */}
              <Text style={styles.inputLabel}>Note (Optional)</Text>
              <TextInput
                style={[styles.input, styles.noteInput]}
                placeholder="Add a note..."
                placeholderTextColor="#999"
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
              />

              {/* Action Buttons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setAmount('');
                    setCategory('Food');
                    setNote('');
                    setModalVisible(false);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.modalButton, styles.saveButton]}
                  onPress={addExpense}
                >
                  <Text style={styles.saveButtonText}>Add Expense</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
{/* Edit Expense Modal */}
<Modal
  animationType="slide"
  transparent={true}
  visible={editModalVisible}
  onRequestClose={() => setEditModalVisible(false)}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalContainer}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.modalTitle}>Edit Expense</Text>

        {/* Amount Input */}
        <Text style={styles.inputLabel}>Amount ($)</Text>
        <TextInput
          style={styles.input}
          placeholder="0.00"
          placeholderTextColor="#999"
          value={editAmount}
          onChangeText={setEditAmount}
          keyboardType="decimal-pad"
        />

        {/* Category Selection */}
        <Text style={styles.inputLabel}>Category</Text>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoryContainer}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryButton,
                editCategory === cat && styles.categoryButtonActive
              ]}
              onPress={() => setEditCategory(cat)}
            >
              <Text
                style={[
                  styles.categoryButtonText,
                  editCategory === cat && styles.categoryButtonTextActive
                ]}
              >
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Date Input */}
        <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="2025-01-15"
          placeholderTextColor="#999"
          value={editDate}
          onChangeText={setEditDate}
        />

        {/* Note Input */}
        <Text style={styles.inputLabel}>Note (Optional)</Text>
        <TextInput
          style={[styles.input, styles.noteInput]}
          placeholder="Add a note..."
          placeholderTextColor="#999"
          value={editNote}
          onChangeText={setEditNote}
          multiline
          numberOfLines={3}
        />

        {/* Action Buttons */}
        <View style={styles.modalButtons}>
          <TouchableOpacity
            style={[styles.modalButton, styles.cancelButton]}
            onPress={() => {
              setEditModalVisible(false);
              setEditingExpense(null);
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.modalButton, styles.saveButton]}
            onPress={updateExpense}
          >
            <Text style={styles.saveButtonText}>Update</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  </View>
</Modal>
</ScrollView> 
</SafeAreaView>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#3b82f6',
    padding: 20,
    paddingTop: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#dbeafe',
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  expenseItem: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  expenseInfo: {
    flex: 1,
  },
  expenseAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  expenseCategory: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
    marginBottom: 4,
  },
  expenseNote: {
    fontSize: 12,
    color: '#6b7280',
  },
  deleteButton: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  deleteButtonText: {
    color: '#dc2626',
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    color: '#9ca3af',
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#d1d5db',
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  addButtonText: {
    fontSize: 32,
    color: 'white',
    fontWeight: '300',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '85%',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#111827',
    marginBottom: 16,
  },
  noteInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryContainer: {
    marginBottom: 16,
  },
  categoryButton: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryButtonActive: {
    backgroundColor: '#3b82f6',
  },
  categoryButtonText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 14,
  },
  categoryButtonTextActive: {
    color: 'white',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    color: '#6b7280',
    fontWeight: '600',
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
  },
  saveButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  filterContainer: {
  flexDirection: 'row',
  padding: 16,
  gap: 8,
},
filterButton: {
  flex: 1,
  padding: 12,
  borderRadius: 8,
  backgroundColor: '#e5e7eb',
  alignItems: 'center',
},
filterButtonActive: {
  backgroundColor: '#3b82f6',
},
filterButtonText: {
  fontWeight: '600',
  color: '#374151',
  fontSize: 14,
},
filterButtonTextActive: {
  color: 'white',
},
expenseDate: {
  fontSize: 11,
  color: '#9ca3af',
  marginTop: 4,
},
analyticsSection: {
  padding: 16,
  paddingTop: 0,
},
totalCard: {
  backgroundColor: 'white',
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
},
totalLabel: {
  fontSize: 14,
  color: '#6b7280',
  fontWeight: '600',
  marginBottom: 8,
},
totalAmount: {
  fontSize: 32,
  fontWeight: 'bold',
  color: '#3b82f6',
  marginBottom: 4,
},
totalSubtext: {
  fontSize: 12,
  color: '#9ca3af',
},
categoryCard: {
  backgroundColor: 'white',
  borderRadius: 12,
  padding: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
},
categoryTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#374151',
  marginBottom: 12,
},
categoryRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingVertical: 8,
  borderBottomWidth: 1,
  borderBottomColor: '#f3f4f6',
},

// Category row left side with dot
categoryRowLeft: {
  flexDirection: 'row',
  alignItems: 'center',
},
categoryDot: {
  width: 10,
  height: 10,
  borderRadius: 5,
  marginRight: 8,
},


categoryName: {
  fontSize: 14,
  color: '#374151',
},
categoryAmount: {
  fontSize: 14,
  fontWeight: '600',
  color: '#3b82f6',
},
expenseActions: {
  flexDirection: 'row',
  gap: 8,
},
editButton: {
  backgroundColor: '#dbeafe',
  paddingHorizontal: 12,
  paddingVertical: 8,
  borderRadius: 8,
},
editButtonText: {
  color: '#3b82f6',
  fontWeight: '600',
},


// Chart styles
toggleContainer: {
  padding: 16,
  paddingTop: 0,
},
chartCard: {
  backgroundColor: 'white',
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 4,
  elevation: 3,
},
chartTitle: {
  fontSize: 16,
  fontWeight: '600',
  color: '#374151',
  marginBottom: 12,
},

});

