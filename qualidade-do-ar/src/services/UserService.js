import User from '../models/User.js';

class UserService {
  /**
   * Cria um novo usuário
   */
  async createUser(userData) {
    try {
      const existingUser = await User.findOne({ phoneNumber: userData.phoneNumber });
      if (existingUser) {
        throw new Error('Usuário com este número já existe');
      }

      const user = await User.create({
        ...userData,
        active: true
      });

      return user;
    } catch (error) {
      throw new Error(`Erro ao criar usuário: ${error.message}`);
    }
  }

  async updateUserLocation(userId, location) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { location: location },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      return user;
    } catch (error) {
      throw new Error(`Erro ao atualizar localização do usuário: ${error.message}`);
    }
  }

  // update user notification preferences -> timeOfDay
  async updateUserNotificationPreferences(userId, preferences) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { notificationPreferences: preferences },
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      return user;
    } catch (error) {
      throw new Error(`Erro ao atualizar preferências de notificação do usuário: ${error.message}`);
    }
  }

  /**
   * Busca todos os usuários
   */
  async getAllUsers(filters = {}) {
    try {
      const users = await User.find(filters);
      return users;
    } catch (error) {
      throw new Error(`Erro ao buscar usuários: ${error.message}`);
    }
  }

  /**
   * Busca usuário por ID
   */
  async getUserById(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }
      return user;
    } catch (error) {
      throw new Error(`Erro ao buscar usuário: ${error.message}`);
    }
  }

  async getUserByWhatsAppNumber(phoneNumber) {
    try {
      const user = await User.findOne({ phoneNumber: phoneNumber });
      return user;
    } catch (error) {
      throw new Error(`Erro ao buscar usuário pelo WhatsApp: ${error.message}`);
    }
  }

  /**
   * Atualiza um usuário
   */
  async updateUser(userId, updateData) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        updateData,
        { new: true, runValidators: true }
      );

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      return user;
    } catch (error) {
      throw new Error(`Erro ao atualizar usuário: ${error.message}`);
    }
  }

  /**
   * Remove um usuário
   */
  async deleteUser(userId) {
    try {
      const user = await User.findByIdAndDelete(userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }
      return user;
    } catch (error) {
      throw new Error(`Erro ao remover usuário: ${error.message}`);
    }
  }

  async setUserActive(userId, isActive) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { active: isActive },
      );

      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      return user;
    } catch (error) {
      throw new Error(`Erro ao atualizar status ativo do usuário: ${error.message}`);
    }
  }

  /**
   * Alterna o status ativo/inativo do usuário
   */
  async toggleUserActive(userId) {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('Usuário não encontrado');
      }

      user.active = !user.active;
      await user.save();
      
      return user;
    } catch (error) {
      throw new Error(`Erro ao alterar status do usuário: ${error.message}`);
    }
  }

  /**
   * Busca usuários ativos para notificação
   */
  async getActiveUsersForNotification() {
    try {
      return await User.find({
        active: true,
        'notificationPreferences.frequency': { $exists: true }
      });
    } catch (error) {
      throw new Error(`Erro ao buscar usuários para notificação: ${error.message}`);
    }
  }

  /**
   * Valida número de telefone
   */
  validatePhoneNumber(phoneNumber) {
    const phoneRegex = /^55\d{10,11}$/;
    return phoneRegex.test(phoneNumber);
  }
}

export default new UserService();